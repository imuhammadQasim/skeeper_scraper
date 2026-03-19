import axios from "axios";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config();

const API_URL = "https://app.im.skeepers.io/api/v3/campaigns";
const LOGIN_URL = "https://creator.im.skeepers.io/auth/signin/en";
const SKEEPERS_EMAIL = process.env.SKEEPERS_EMAIL;
const SKEEPERS_PASSWORD = process.env.SKEEPERS_PASSWORD;

async function refreshAuth() {
  console.log("Refreshing authentication session...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 60000 });
    if (page.url().includes("login") || page.url().includes("signin")) {
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

    await browser.close();
    return token;
  } catch (error) {
    console.error("Error during auth refresh:", error);
    await browser.close();
    return null;
  }
}

async function runTest() {
  const token = await refreshAuth();
  if (!token) return;

  const headers = {
    "access-token": token,
    "x-requested-with": "XMLHttpRequest",
    Accept: "application/json",
    Origin: "https://creator.im.skeepers.io",
    Referer: "https://creator.im.skeepers.io/",
  };

  const countries = ["FR", "US"];
  
  for (const country of countries) {
    console.log(`\nTesting filter for country: ${country}`);
    try {
      const response = await axios.get(API_URL, {
        params: {
          format: "attributes",
          include: "store",
          "page[size]": 5,
          "page[number]": 1,
          sort: "-last_published_at",
          "filter[country_code]": country
        },
        headers
      });

      const campaigns = response.data || [];
      console.log(`Found ${campaigns.length} campaigns`);
      campaigns.forEach(c => {
        const countryCode = c.attributes?.store?.country_code || c.store?.country_code;
        console.log(`- Product: ${c.attributes?.title || c.title}, Country: ${countryCode}`);
      });
    } catch (err) {
      console.error(`Error with filter ${country}:`, err.message);
    }
  }
  
  // Try another filter style
  console.log(`\nTesting filter[store][country_code]: FR`);
  try {
    const response = await axios.get(API_URL, {
      params: {
        format: "attributes",
        include: "store",
        "page[size]": 5,
        "page[number]": 1,
        sort: "-last_published_at",
        "filter[store][country_code]": "FR"
      },
      headers
    });
    const campaigns = response.data || [];
    console.log(`Found ${campaigns.length} campaigns`);
    campaigns.forEach(c => {
      const countryCode = c.attributes?.store?.country_code || c.store?.country_code;
      console.log(`- Product: ${c.attributes?.title || c.title}, Country: ${countryCode}`);
    });
  } catch (err) {
    console.error(`Error with nested filter:`, err.message);
  }
}

runTest();
