# Skeepers Product Monitor (Node.js)

A backend automation tool to monitor Skeepers for new product listings.

## Setup Instructions

1. **Install Dependencies**:

   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure Environment**:
   Rename `.env.example` to `.env` and fill in your details:
   - `SKEEPERS_EMAIL`: Your Skeepers account email.
   - `SKEEPERS_PASSWORD`: Your Skeepers account password.
   - `EMAIL_USER`: Your email (e.g., Gmail address).
   - `EMAIL_PASS`: Your email password (use an "App Password" for Gmail).
   - `EMAIL_RECEIVER`: Where to send alerts.
   - `TELEGRAM_BOT_TOKEN`: (Optional) Your bot token from BotFather.
   - `TELEGRAM_CHAT_ID`: (Optional) Your chat ID.
   - `MONITOR_URL`: The specific gallery page URL.
   - `CHECK_INTERVAL`: Delay between checks in seconds (default: 30).
   - `HEADLESS`: Set to `true` for background mode, `false` to see the browser.

3. **Run the Scraper**:
   ```bash
   npm start
   ```

## Available Scripts

- `npm start` - Start the monitoring loop
- `npm run test` - Run a quick test to verify scraping works
- `npm run login` - Manually save login session (optional, auto-login is enabled)
- `npm run migrate` - Migrate old database format to new format

## Database Format

The `seen_products.json` file now stores detailed information about each campaign:

```json
[
  {
    "id": "hd5lb",
    "title": "Summer Skin No.32 Gradual Self-Tanning Cream",
    "storeName": "Lux Unfiltered",
    "link": "https://creator.im.skeepers.io/campaigns/hd5lb",
    "firstSeen": "2026-01-24T04:30:15.123Z",
    "lastChecked": "2026-01-24T04:45:20.456Z"
  }
]
```

**Fields:**

- `id`: Unique campaign identifier
- `title`: Product/campaign title
- `storeName`: Brand or store name
- `link`: Direct link to the campaign
- `firstSeen`: Timestamp when first detected
- `lastChecked`: Timestamp of last scrape run

## Files

- `scraper.js`: The main automation logic.
- `loginHelper.js`: Tool to save your login session.
- `notifications.js`: Alert functions (Email/Telegram).
- `storage.js`: Enhanced JSON-based product tracking with metadata.
- `quick-test.js`: Quick test script to verify scraping.
- `migrate-db.js`: Database migration utility.
- `seen_products.json`: (Generated) Stores campaign data with metadata.
- `auth.json`: (Generated) Stores your encrypted login session.
