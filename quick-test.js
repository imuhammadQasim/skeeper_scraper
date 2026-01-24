import { chromium } from "playwright";
import dotenv from "dotenv";

dotenv.config();

const MONITOR_URL =
  process.env.MONITOR_URL || "https://creator.im.skeepers.io/campaigns/search";
const LOGIN_URL = "https://creator.im.skeepers.io/auth/signin/en";
const SKEEPERS_EMAIL = process.env.SKEEPERS_EMAIL;
const SKEEPERS_PASSWORD = process.env.SKEEPERS_PASSWORD;

async function quickTest() {
  console.log("🔍 Quick Test - Checking Campaign Scraping...\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login first
    console.log("📝 Logging in...");
    await page.goto(LOGIN_URL, { waitUntil: "networkidle" });

    await page.fill('input[name="email"]', SKEEPERS_EMAIL);
    await page.fill('input[type="password"]', SKEEPERS_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: "networkidle" });
    console.log("✅ Login successful!\n");

    // Navigate to campaigns
    console.log("🌐 Navigating to campaigns page...");
    await page.goto(MONITOR_URL, { waitUntil: "networkidle" });
    console.log(`Current URL: ${page.url()}\n`);

    // Find campaigns
    const campaignSelector = 'a[class*="Campaign-sc-"]';
    await page.waitForSelector(campaignSelector, { timeout: 10000 });

    const campaigns = await page.$$(campaignSelector);
    console.log(`✅ Found ${campaigns.length} campaigns!\n`);

    // Extract first 3 campaigns as examples
    console.log("📋 Sample Campaigns:");
    console.log("─".repeat(80));

    for (let i = 0; i < Math.min(3, campaigns.length); i++) {
      const campaign = campaigns[i];
      const href = await campaign.getAttribute("href");
      const campaignId = href.split("/").pop();

      const titleElement = await campaign.$('strong[class*="Title-sc-"]');
      const title = titleElement
        ? (await titleElement.textContent()).trim()
        : "N/A";

      const storeElement = await campaign.$('div[class*="StoreTitle-sc-"]');
      const storeName = storeElement
        ? (await storeElement.textContent()).trim()
        : "N/A";

      const soldOutElement = await campaign.$('[class*="OutOfStock-sc-"]');
      const isSoldOut = soldOutElement !== null;

      console.log(`${i + 1}. ID: ${campaignId}`);
      console.log(`   Title: ${title}`);
      console.log(`   Store: ${storeName}`);
      console.log(`   Status: ${isSoldOut ? "❌ SOLD OUT" : "✅ AVAILABLE"}`);
      console.log(`   Link: https://creator.im.skeepers.io${href}`);
      console.log("─".repeat(80));
    }

    console.log("\n✅ Test completed! Press Ctrl+C to close...");
    await page.waitForTimeout(30000);
  } catch (error) {
    console.error("❌ Error:", error.message);
    await page.screenshot({ path: "test-error.png" });
  } finally {
    await browser.close();
  }
}

quickTest();
