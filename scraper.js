import { chromium } from "playwright";
import fs from "fs";
import dotenv from "dotenv";
import {
  loadSeenProducts,
  saveSeenProducts,
  isNewProduct,
  addProduct,
  updateLastChecked,
} from "./storage.js";
import { notifyNewProduct, sendHeartbeat } from "./notifications.js";

dotenv.config();

// Configuration
const MONITOR_URL =
  process.env.MONITOR_URL || "https://creator.im.skeepers.io/campaigns/search";
const LOGIN_URL = "https://creator.im.skeepers.io/auth/signin/en";
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 300;
const HEADLESS = process.env.HEADLESS !== "false";
const AUTH_FILE = "auth.json";

const SKEEPERS_EMAIL = process.env.SKEEPERS_EMAIL;
const SKEEPERS_PASSWORD = process.env.SKEEPERS_PASSWORD;

async function performLogin(page) {
  console.log("Attempting automated login...");
  await page.goto(LOGIN_URL, { waitUntil: "load", timeout: 60000 });

  // Selectors for Skeepers login
  await page.fill('input[name="email"]', SKEEPERS_EMAIL);
  await page.fill('input[name="password"]', SKEEPERS_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for navigation after login
  await page.waitForNavigation({
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Save state
  await page.context().storageState({ path: AUTH_FILE });
  console.log("Login successful and session saved.");
}

async function scrapeSkeepers() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: HEADLESS,
      args: ["--disable-gpu", "--disable-dev-shm-usage"],
    });
    let context;

    if (fs.existsSync(AUTH_FILE)) {
      console.log("Using saved session...");
      context = await browser.newContext({ storageState: AUTH_FILE });
    } else {
      console.log("No saved session. Performing fresh login...");
      context = await browser.newContext();
    }

    const page = await context.newPage();
    // Small delay to stabilize browser process on Windows
    await page.waitForTimeout(2000);

    // Go to monitor URL
    console.log(`Navigating to ${MONITOR_URL}...`);
    await page.goto(MONITOR_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // If we are redirected to login/signin, perform login
    if (page.url().includes("login") || page.url().includes("signin")) {
      await performLogin(page);
      await page.goto(MONITOR_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }

    // --- SELECTOR LOGIC ---
    // Based on actual HTML: campaigns are in <a> tags with class starting with "Campaign-sc-"
    const campaignSelector = 'a[class*="Campaign-sc-"]';

    try {
      await page.waitForSelector(campaignSelector, { timeout: 15000 });
    } catch (e) {
      console.warn(
        "Timed out waiting for campaign cards. The page might not have loaded or there are no campaigns.",
      );
      console.log(`Current URL: ${page.url()}`);
      // Take a screenshot for debugging
      await page.screenshot({ path: "debug-no-campaigns.png" });
      return;
    }

    const campaigns = await page.$$(campaignSelector);
    console.log(`Found ${campaigns.length} campaigns on page.`);

    let seenProducts = await loadSeenProducts();
    let newCount = 0;

    for (const campaign of campaigns) {
      try {
        // Get the href directly from the <a> tag
        const href = await campaign.getAttribute("href");

        if (!href) continue;

        // Extract campaign ID from href (e.g., /campaigns/hd5lb -> hd5lb)
        const campaignId = href.split("/").pop();

        // Get the title from the <strong> tag with class starting with "Title-sc-"
        const titleElement = await campaign.$('strong[class*="Title-sc-"]');
        const title = titleElement
          ? (await titleElement.textContent()).trim()
          : "New Campaign";

        // Get the store name
        const storeElement = await campaign.$('div[class*="StoreTitle-sc-"]');
        const storeName = storeElement
          ? (await storeElement.textContent()).trim()
          : "";

        // CHECK IF SOLD OUT
        const soldOutElement = await campaign.$('[class*="OutOfStock-sc-"]');
        const isSoldOut = soldOutElement !== null;

        const fullLink = href.startsWith("http")
          ? href
          : `https://creator.im.skeepers.io${href}`;

        // Find existing product in database
        const existingProductIndex = seenProducts.findIndex(
          (p) => p.id === campaignId,
        );

        if (existingProductIndex === -1) {
          // NEW PRODUCT
          const productInfo = storeName ? `${title} - ${storeName}` : title;

          console.log(
            `✨ NEW CAMPAIGN DETECTED: ${productInfo} (${campaignId}) [SoldOut: ${isSoldOut}]`,
          );

          // Add to seen products with full metadata
          seenProducts = addProduct(seenProducts, {
            id: campaignId,
            title: title,
            storeName: storeName,
            link: fullLink,
            isSoldOut: isSoldOut,
          });

          // ONLY NOTIFY IF NOT SOLD OUT
          if (!isSoldOut) {
            await notifyNewProduct(productInfo, fullLink);
            newCount++;
          } else {
            console.log(
              `⏭️ Skipping notification for ${productInfo} (Sold out)`,
            );
          }
        } else {
          // EXISTING PRODUCT - Update its metadata and status
          const existingProduct = seenProducts[existingProductIndex];
          const oldStatus = existingProduct.isSoldOut;

          // Update details (to fill in "Unknown" from migration or refresh data)
          existingProduct.title = title;
          existingProduct.storeName = storeName;
          existingProduct.link = fullLink;
          existingProduct.isSoldOut = isSoldOut;

          // If it was sold out and is now available, notify!
          if (oldStatus === true && isSoldOut === false) {
            const productInfo = storeName ? `${title} - ${storeName}` : title;
            console.log(
              `🔥 PRODUCT BACK IN STOCK: ${productInfo} (${campaignId})`,
            );
            await notifyNewProduct(`[BACK IN STOCK] ${productInfo}`, fullLink);
          }
        }
      } catch (err) {
        console.error("Error processing campaign:", err);
        continue;
      }
    }

    // Update last checked timestamp for all products
    seenProducts = updateLastChecked(seenProducts);

    // Save to database
    await saveSeenProducts(seenProducts);

    if (newCount > 0) {
      console.log(`✅ Saved ${newCount} new campaign(s) to database.`);
    } else {
      console.log("No new campaigns found.");
    }
  } catch (error) {
    console.error("An error occurred during scraping:", error);
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  console.log("--- Skeepers Creator Monitor Started ---");
  if (!SKEEPERS_EMAIL || !SKEEPERS_PASSWORD) {
    console.error("ERROR: SKEEPERS_EMAIL or SKEEPERS_PASSWORD not set in .env");
    process.exit(1);
  }

  let lastHeartbeat = 0;
  let scrapeCount = 0;
  const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  while (true) {
    try {
      await scrapeSkeepers();
      scrapeCount++;

      // Check if it's time to send a status heartbeat to the client
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        console.log("Sending daily heartbeat status email...");
        const seenProducts = await loadSeenProducts();
        await sendHeartbeat({
          totalItems: seenProducts.length,
          interval: CHECK_INTERVAL,
          scrapeCount: scrapeCount,
        });
        lastHeartbeat = now;
        scrapeCount = 0; // Reset counter for the next 24-hour period
      }
    } catch (err) {
      console.error("Monitor loop error:", err);
    }
    console.log(`Waiting ${CHECK_INTERVAL} seconds for next check...`);
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL * 1000));
  }
}

main();
