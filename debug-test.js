import axios from "axios";
import dotenv from "dotenv";
import { chromium } from "playwright";
import fs from "fs/promises";

dotenv.config();

const API_URL = "https://app.im.skeepers.io/api/v3/campaigns";
const LOGIN_URL = "https://creator.im.skeepers.io/auth/signin/fr";
const SKEEPERS_EMAIL = process.env.SKEEPERS_EMAIL;
const SKEEPERS_PASSWORD = process.env.SKEEPERS_PASSWORD;

async function testBackend() {
  console.log("--- Skeepers Backend Diagnostic ---");
  console.log(`Email: ${SKEEPERS_EMAIL}`);
  console.log("Refreshing auth...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 60000 });

    if (page.url().includes("login") || page.url().includes("signin")) {
      console.log("Logging in...");
      await page.fill('input[name="email"]', SKEEPERS_EMAIL);
      await page.fill('input[name="password"]', SKEEPERS_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 60000 });
    }

    const token = await page.evaluate(() => {
      return (
        localStorage.getItem("skeepers_auth_token_production") ||
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("skeepers_auth_token")
      );
    });

    if (!token) {
      console.error("Failed to extract token!");
      return;
    }

    console.log("Token extracted. Fetching Page 1 of campaigns...");

    const response = await axios.get(API_URL, {
      params: {
        format: "attributes",
        include: "store",
        "page[size]": 10,
        "page[number]": 1,
        sort: "-last_published_at",
      },
      headers: {
        "access-token": token,
        "x-requested-with": "XMLHttpRequest",
        Accept: "application/json",
      },
    });

    const campaigns = response.data || [];
    console.log(`Successfully fetched ${campaigns.length} campaigns.`);

    if (campaigns.length > 0) {
      const first = campaigns[0];
      const attrs = first.attributes || first;
      console.log("\n--- Latest Product Details ---");
      console.log(`Title: ${attrs.title}`);
      console.log(`Store: ${attrs.store?.display_name || attrs.store?.name}`);
      console.log(`Country: ${attrs.store?.country_code}`);
      console.log(`Status: ${attrs.status}`);
      console.log(`Sold Out: ${attrs.sold_out}`);
      console.log(`Closed: ${attrs.closed}`);
      console.log(`Published At: ${attrs.last_published_at || attrs.published_at}`);
      
      // Save full response for inspection
      await fs.writeFile("./tmp/debug_response.json", JSON.stringify(campaigns, null, 2));
      console.log("\nFull response saved to ./tmp/debug_response.json");
    }

  } catch (error) {
    console.error("Test failed:", error.message);
    if (error.response) {
      console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await browser.close();
  }
}

testBackend();
