import { chromium } from "playwright";
import dotenv from "dotenv";

dotenv.config();

const LOGIN_URL = "https://creator.im.skeepers.io/auth/signin/en";
const SKEEPERS_EMAIL = process.env.SKEEPERS_EMAIL;
const SKEEPERS_PASSWORD = process.env.SKEEPERS_PASSWORD;

async function testLogin() {
  console.log("Starting login test...");
  const browser = await chromium.launch({ headless: false }); // Run in visible mode
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${LOGIN_URL}...`);
    await page.goto(LOGIN_URL, { waitUntil: "networkidle" });

    // Take a screenshot before login
    await page.screenshot({ path: "before-login.png" });
    console.log("Screenshot saved: before-login.png");

    // Wait a bit to see the page
    await page.waitForTimeout(2000);

    // Try to find email input with multiple selectors
    console.log("Looking for email input...");
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[id*="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
    ];

    let emailInput = null;
    for (const selector of emailSelectors) {
      emailInput = await page.$(selector);
      if (emailInput) {
        console.log(`Found email input with selector: ${selector}`);
        break;
      }
    }

    if (!emailInput) {
      console.error("Could not find email input!");
      await page.screenshot({ path: "email-not-found.png" });
      return;
    }

    // Try to find password input
    console.log("Looking for password input...");
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id*="password"]',
    ];

    let passwordInput = null;
    for (const selector of passwordSelectors) {
      passwordInput = await page.$(selector);
      if (passwordInput) {
        console.log(`Found password input with selector: ${selector}`);
        break;
      }
    }

    if (!passwordInput) {
      console.error("Could not find password input!");
      await page.screenshot({ path: "password-not-found.png" });
      return;
    }

    // Fill in credentials
    console.log("Filling in credentials...");
    await emailInput.fill(SKEEPERS_EMAIL);
    await passwordInput.fill(SKEEPERS_PASSWORD);

    await page.waitForTimeout(1000);

    // Find submit button
    console.log("Looking for submit button...");
    const buttonSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign in")',
      'button:has-text("Login")',
      'button:has-text("Log in")',
      'input[type="submit"]',
    ];

    let submitButton = null;
    for (const selector of buttonSelectors) {
      submitButton = await page.$(selector);
      if (submitButton) {
        console.log(`Found submit button with selector: ${selector}`);
        break;
      }
    }

    if (!submitButton) {
      console.error("Could not find submit button!");
      await page.screenshot({ path: "button-not-found.png" });
      return;
    }

    // Click submit
    console.log("Clicking submit button...");
    await submitButton.click();

    // Wait for navigation
    console.log("Waiting for navigation...");
    await page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 });

    console.log(`Current URL after login: ${page.url()}`);

    // Take screenshot after login
    await page.screenshot({ path: "after-login.png" });
    console.log("Screenshot saved: after-login.png");

    // Save session
    await context.storageState({ path: "auth.json" });
    console.log("Session saved to auth.json");

    console.log("Login test completed successfully!");
    console.log("Press Ctrl+C to close the browser...");

    // Keep browser open for inspection
    await page.waitForTimeout(60000);
  } catch (error) {
    console.error("Error during login test:", error);
    await page.screenshot({ path: "error.png" });
  } finally {
    await browser.close();
  }
}

testLogin();
