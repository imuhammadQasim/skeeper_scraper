import { chromium } from "playwright";
import readline from "readline";

const AUTH_FILE = "auth.json";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function login() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const url = "https://app.skeepers.io/influencer/login";
  console.log(`Opening ${url} for manual login...`);
  await page.goto(url);

  console.log("Please log in to Skeepers in the browser window.");
  console.log(
    "Once you are logged in and see the product gallery, return here and press Enter.",
  );

  rl.question(
    "Press Enter after you have logged in and are on the dashboard/store page...",
    async () => {
      await context.storageState({ path: AUTH_FILE });
      console.log(
        `Session saved to ${AUTH_FILE}. You can now run the scraper.`,
      );
      await browser.close();
      process.exit(0);
    },
  );
}

login().catch((err) => {
  console.error("Error during login:", err);
  process.exit(1);
});
