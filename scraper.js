import axios from "axios";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { loadSeenCampaigns, saveSeenCampaigns } from "./storage.js";
import { notifyNewProduct, sendHeartbeat } from "./notifications.js";

dotenv.config();

// Configuration
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const API_URL = "https://app.im.skeepers.io/api/v3/campaigns";
const LOGIN_URL = "https://creator.im.skeepers.io/auth/signin/fr";
const TARGET_REGION = process.env.TARGET_REGION || "FR"; // Default to France
const MIN_CHECK_INTERVAL = 20; // seconds
const MAX_CHECK_INTERVAL = 40; // seconds
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
        "User-Agent": getRandomUserAgent(),
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
          "User-Agent": getRandomUserAgent(),
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
 * Helper for sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a list of campaigns and notify for new ones
 * @returns {number} Number of new campaigns found
 */
async function processCampaigns(campaigns, seenCampaigns) {
  let newlySeenCount = 0;
  const target = (TARGET_REGION || "FR").toUpperCase();

  for (const campaign of campaigns) {
    const campaignId = campaign.id;
    const attrs = campaign.attributes || campaign;
    const countryCode = attrs.store?.country_code || "";
    const currentCountry = (countryCode || "").toUpperCase();

    // Region Filter
    if (target && currentCountry !== target) {
      continue;
    }

    // Skip if already seen
    if (seenCampaigns.includes(campaignId)) {
      continue;
    }

    const title = attrs.title || "Unknown Campaign";
    const storeName = attrs.store?.display_name || attrs.store?.name || "";
    const productInfo = storeName ? `${title} - ${storeName}` : title;

    const webPath = campaign.web_path || attrs.web_path || "";
    const cleanPath = webPath.startsWith("/creators")
      ? webPath.replace("/creators", "")
      : webPath;
    const fullLink = `https://creator.im.skeepers.io${cleanPath}`;

    const photoUrl =
      attrs.photo_urls?.medium ||
      attrs.photo_urls?.large ||
      attrs.photo_urls?.small ||
      "";
    const isSoldOut = attrs.sold_out === true;
    const status = attrs.status || "active";

    console.log(`✨ New campaign detected [${currentCountry}]: ${productInfo}`);
    console.log(`   └─ Status: ${status} | Sold Out: ${isSoldOut}`);

    // Fire notification for ALL new items (including sold out) so user can track them
    console.log(`   └─ 📧 Sending notification...`);
    notifyNewProduct(productInfo, fullLink, photoUrl, status, isSoldOut).catch((err) =>
      console.error("Notification error:", err),
    );

    seenCampaigns.push(campaignId);
    newlySeenCount++;
  }
  return newlySeenCount;
}

/**
 * Main check logic: Fetch and process page by page for maximum speed
 */
async function checkForNewCampaigns() {
  try {
    console.log("Checking campaigns (page by page)...");
    let seenCampaigns = await loadSeenCampaigns();
    let totalNewlySeen = 0;

    // Fetch campaigns page by page. Most new items are on page 1.
    for (let page = 1; page <= 7; page++) {
      const campaigns = await fetchCampaignPage(page);

      if (!campaigns || campaigns.length === 0) break;

      const newlySeenOnThisPage = await processCampaigns(
        campaigns,
        seenCampaigns,
      );
      totalNewlySeen += newlySeenOnThisPage;

      // If we found new items on page 1, we definitely want to check further pages.
      // If we are on later pages and find nothing new for a while, we could potentially stop early.

      if (page < 7) {
        // Shorter delay between pages than before (1-2 seconds)
        const pageDelay = getRandomInt(1, 2);
        await sleep(pageDelay * 1000);
      }
    }

    if (totalNewlySeen > 0) {
      await saveSeenCampaigns(seenCampaigns);
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

  let lastHeartbeat = Date.now();
  let scrapeCount = 0;
  const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  // 6 Monitoring loop
  while (true) {
    try {
      await checkForNewCampaigns();
      scrapeCount++;

      // Heartbeat logic
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        console.log("Sending daily heartbeat...");
        const seenCampaigns = await loadSeenCampaigns();
        await sendHeartbeat({
          totalItems: seenCampaigns.length,
          interval: `${MIN_CHECK_INTERVAL}-${MAX_CHECK_INTERVAL}`,
          scrapeCount: scrapeCount,
        });
        lastHeartbeat = now;
        scrapeCount = 0;
      }
    } catch (err) {
      console.error("Error in monitor cycle:", err);
    }

    const currentWait = getRandomInt(MIN_CHECK_INTERVAL, MAX_CHECK_INTERVAL);
    console.log(`Waiting ${currentWait} seconds for next cycle...`);
    await new Promise((resolve) => setTimeout(resolve, currentWait * 1000));
  }
}

// Start the application
if (process.env.RUN_ONCE === "true") {
  (async () => {
    await refreshAuth();
    await checkForNewCampaigns();
    process.exit(0);
  })();
} else {
  startMonitor();
}
