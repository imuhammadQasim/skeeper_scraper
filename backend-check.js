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

    const tokenData = await page.evaluate(() => {
      const val = localStorage.getItem("skeepers_auth_token_production") || localStorage.getItem("token");
      return val;
    });

    const response = await axios.get(API_URL, {
      params: { 
        format: "attributes", 
        include: "store", 
        "page[size]": 1, 
        sort: "-last_published_at" 
      },
      headers: { "access-token": tokenData, "x-requested-with": "XMLHttpRequest" }
    });

    const fullProduct = response.data[0];
    await fs.writeFile("raw-product.json", JSON.stringify(fullProduct, null, 2));
    console.log("Raw product data saved to raw-product.json");

  } catch (error) {
    console.error(`Check failed: ${error.message}`);
  } finally {
    await browser.close();
  }
}

testBackend();
