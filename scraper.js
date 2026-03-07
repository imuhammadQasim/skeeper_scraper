import axios from "axios";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { loadSeenCampaigns, saveSeenCampaigns } from "./storage.js";
import { notifyNewProduct, sendHeartbeat } from "./notifications.js";

dotenv.config();

// Configuration
const API_URL = "https://app.im.skeepers.io/api/v3/campaigns";
const LOGIN_URL = "https://creator.im.skeepers.io/auth/signin/en";
const CHECK_INTERVAL = 30; // 120 seconds as requested
const AUTH_FILE = "auth.json";

const SKEEPERS_EMAIL = process.env.SKEEPERS_EMAIL;
const SKEEPERS_PASSWORD = process.env.SKEEPERS_PASSWORD;

let authHeaders = {};

/**
 * Perform login and extract necessary auth headers
 */
async function refreshAuth() {
  console.log("Refreshing authentication session...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 60000 });

    // Check if we need to login
    if (page.url().includes("login") || page.url().includes("signin")) {
      console.log("Automated login in progress...");
      await page.fill('input[name="email"]', SKEEPERS_EMAIL);
      await page.fill('input[name="password"]', SKEEPERS_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({
        waitUntil: "networkidle",
        timeout: 60000,
      });
    }

    // Save storage state
    await context.storageState({ path: AUTH_FILE });

    // Extract token from localStorage
    const token = await page.evaluate(() => {
      // Try to find the token in known localStorage keys
      return (
        localStorage.getItem("skeepers_auth_token_production") ||
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("skeepers_auth_token")
      );
    });

    if (token) {
      authHeaders = {
        "access-token": token,
        "x-requested-with": "XMLHttpRequest",
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://creator.im.skeepers.io",
        Referer: "https://creator.im.skeepers.io/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      };
      console.log("Auth token extracted successfully and headers updated.");
    } else {
      // Fallback: try to find it in cookies
      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find(
        (c) =>
          c.name === "access-token" ||
          c.name === "skeepers_auth_token_production",
      );

      if (accessTokenCookie) {
        authHeaders = {
          "access-token": accessTokenCookie.value,
          "x-requested-with": "XMLHttpRequest",
          Accept: "application/json",
          Origin: "https://creator.im.skeepers.io",
          Referer: "https://creator.im.skeepers.io/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };
        console.log("Token found in cookies successfully.");
      } else {
        console.warn("Could not find auth token in localStorage or cookies.");
      }
    }
  } catch (error) {
    console.error("Error during auth refresh:", error);
  } finally {
    await browser.close();
  }
}

/**
 * Fetch a single page of campaigns
 */
async function fetchCampaignPage(pageNumber) {
  try {
    const response = await axios.get(API_URL, {
      params: {
        format: "attributes",
        include: "store",
        "page[size]": 9,
        "page[number]": pageNumber,
        sort: "-last_published_at",
      },
      headers: {
        ...authHeaders,
        // Ensure no caching headers that would cause 304
        "If-None-Match": undefined,
        "If-Modified-Since": undefined,
      },
    });

    return response.data || [];
  } catch (error) {
    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      console.log("Session expired. Refreshing auth...");
      await refreshAuth();
      // Retry once after refresh
      return await fetchCampaignPage(pageNumber);
    }
    console.error(`Error fetching page ${pageNumber}:`, error.message);
    return [];
  }
}

/**
 * Fetch campaigns from multiple pages
 */
async function fetchAllCampaigns() {
  console.log("Checking campaigns...");
  let allCampaigns = [];
  // Fetch campaigns from pages 1 to 7 to cover ~60 products
  for (let page = 1; page <= 7; page++) {
    const campaigns = await fetchCampaignPage(page);
    allCampaigns = allCampaigns.concat(campaigns);
  }
  console.log(`Found ${allCampaigns.length} campaigns across pages`);
  return allCampaigns;
}

/**
 * Check if a campaign is available (not sold out and not closed)
 */
function isCampaignAvailable(campaign) {
  const attrs = campaign.attributes || campaign; // Handle different response formats if needed

  // A campaign is available when: sold_out === false, closed === false, status !== "closed"
  const isAvailable =
    attrs.sold_out === false &&
    attrs.closed === false &&
    attrs.status !== "closed";

  return isAvailable;
}

/**
 * Process campaigns and notify for new ones
 */
async function checkForNewCampaigns(isBootstrap = false) {
  try {
    const campaigns = await fetchAllCampaigns();
    let seenCampaigns = await loadSeenCampaigns();
    let newlySeenCount = 0;

    for (const campaign of campaigns) {
      const campaignId = campaign.id;
      const attrs = campaign.attributes || campaign;
      const title = attrs.title || "Unknown Campaign";
      const storeName = attrs.store?.display_name || attrs.store?.name || "";
      const productInfo = storeName ? `${title} - ${storeName}` : title;
      const webPath = campaign.web_path || attrs.web_path;
      const fullLink = `https://app.im.skeepers.io${webPath}`;

      if (seenCampaigns.includes(campaignId)) {
        // Already seen, skip duplicate notification
        continue;
      }

      // NEW campaign detected
      if (!isBootstrap) {
        if (isCampaignAvailable(campaign)) {
          console.log(`✨ New campaign detected: ${productInfo}`);
          await notifyNewProduct(productInfo, fullLink);
        } else {
          const reason = attrs.sold_out
            ? "sold out"
            : attrs.status === "closed" || attrs.closed
              ? "closed"
              : "unavailable";
          console.log(
            `⏭️  New campaign detected: ${productInfo} (Skipping: ${reason})`,
          );
        }
      }

      // Add to cache
      seenCampaigns.push(campaignId);
      newlySeenCount++;
    }

    if (newlySeenCount > 0) {
      await saveSeenCampaigns(seenCampaigns);
    }

    if (isBootstrap) {
      console.log(
        `Bootstrap completed. Processed ${newlySeenCount} campaigns.`,
      );
    }
  } catch (error) {
    console.error("Error in checkForNewCampaigns:", error);
  }
}

/**
 * Main monitoring loop
 */
async function startMonitor() {
  console.log("--- Skeepers API Monitor Started ---");

  if (!SKEEPERS_EMAIL || !SKEEPERS_PASSWORD) {
    console.error("ERROR: SKEEPERS_EMAIL or SKEEPERS_PASSWORD not set in .env");
    process.exit(1);
  }

  // Initial auth
  await refreshAuth();

  // 5 Bootstrap step: load existing campaigns without sending alerts
  console.log("Bootstrapping existing campaigns...");
  await checkForNewCampaigns(true);

  let lastHeartbeat = Date.now();
  let scrapeCount = 0;
  const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  // 6 Monitoring loop
  while (true) {
    try {
      await checkForNewCampaigns(false);
      scrapeCount++;

      // Heartbeat logic
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        console.log("Sending daily heartbeat...");
        const seenCampaigns = await loadSeenCampaigns();
        await sendHeartbeat({
          totalItems: seenCampaigns.length,
          interval: CHECK_INTERVAL,
          scrapeCount: scrapeCount,
        });
        lastHeartbeat = now;
        scrapeCount = 0;
      }
    } catch (err) {
      console.error("Error in monitor cycle:", err);
    }

    console.log(`Waiting ${CHECK_INTERVAL} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL * 1000));
  }
}

// Start the application
if (process.env.RUN_ONCE === "true") {
  (async () => {
    await refreshAuth();
    await checkForNewCampaigns(false);
    process.exit(0);
  })();
} else {
  startMonitor();
}
