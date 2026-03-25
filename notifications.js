import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const {
  SMTP_SERVER,
  SMTP_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_RECEIVER,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} = process.env;

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!EMAIL_USER || !EMAIL_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_SERVER || "smtp.gmail.com",
    port: parseInt(SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
  return transporter;
}

export async function sendEmailAlert(
  productName,
  productLink,
  productImage,
  status,
  isSoldOut,
) {
  const currentTransporter = getTransporter();
  if (!currentTransporter || !EMAIL_RECEIVER) {
    console.warn("Email configuration missing. Skipping email alert.");
    return;
  }

  const badgeColor = isSoldOut ? "#ef4444" : "#10b981";
  const badgeBg = isSoldOut ? "#fef2f2" : "#ecfdf5";
  const statusText = isSoldOut
    ? "SOLD OUT"
    : status
      ? status.toUpperCase()
      : "AVAILABLE";

  const mailOptions = {
    from: `"Skeepers Monitor" <${EMAIL_USER}>`,
    to: EMAIL_RECEIVER,
    subject: `${isSoldOut ? "📢" : "🚨"} ${statusText}: ${productName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; }
          .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          .header { padding: 32px 32px 16px; text-align: center; }
          .brand { color: #6366f1; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; display: block; }
          .title { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.3; }
          .content { padding: 0 32px 32px; }
          .image-wrapper { margin: 24px 0; border-radius: 12px; overflow: hidden; border: 1px solid #f1f5f9; text-align: center; }
          .product-image { max-width: 100%; height: auto; display: block; margin: 0 auto; }
          .status-badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 24px; color: ${badgeColor}; background-color: ${badgeBg}; text-transform: uppercase; letter-spacing: 0.05em; }
          .product-name { font-size: 18px; color: #334155; margin-bottom: 32px; text-align: center; line-height: 1.5; font-weight: 500; }
          .button-wrapper { text-align: center; }
          .button { background-color: #6366f1; color: #ffffff !important; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s; }
          .footer { padding: 24px; background-color: #f8fafc; text-align: center; border-top: 1px solid #f1f5f9; }
          .footer-text { color: #94a3b8; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="brand">Skeepers Monitor</span>
            <h1 class="title">New Campaign Published</h1>
          </div>
          <div class="content">
            <div class="image-wrapper">
              ${productImage ? `<img src="${productImage}" alt="${productName}" class="product-image">` : `<div style="padding: 40px; background: #f1f5f9; color: #94a3b8;">No Image Available</div>`}
            </div>
            <div style="text-align: center;">
              <div class="status-badge">${statusText}</div>
              <p class="product-name">${productName}</p>
              <div class="button-wrapper">
                <a href="${productLink}" class="button">Apply for Campaign</a>
              </div>
            </div>
          </div>
          <div class="footer">
            <p class="footer-text">Automated monitoring by Skeepers Scraper Pro</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await currentTransporter.sendMail(mailOptions);
    console.log(`Email alert sent for: ${productName} [${statusText}]`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

export async function sendTelegramAlert(
  productName,
  productLink,
  productImage,
  status,
  isSoldOut,
) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    // console.warn("Telegram configuration missing. Skipping Telegram alert.");
    return;
  }

  const statusEmoji = isSoldOut ? "🔴" : "🟢";
  const statusText = isSoldOut
    ? "SOLD OUT"
    : status
      ? status.toUpperCase()
      : "AVAILABLE";

  const message = `${statusEmoji} *${statusText} Alert*\n\n*Product:* ${productName}\n\n[Open in Skeepers](${productLink})`;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    });
    console.log(`Telegram alert sent for: ${productName}`);
  } catch (error) {
    console.error(
      "Error sending Telegram notification:",
      error.response?.data || error.message,
    );
  }
}

export async function notifyNewProduct(
  productName,
  productLink,
  productImage,
  status,
  isSoldOut,
) {
  // Fire both in parallel for speed
  await Promise.allSettled([
    sendEmailAlert(productName, productLink, productImage, status, isSoldOut),
    // sendTelegramAlert(productName, productLink, productImage, status, isSoldOut),
  ]);
}

export async function sendHeartbeat(stats) {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_RECEIVER) {
    console.warn("Email configuration missing. Skipping heartbeat.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_SERVER || "smtp.gmail.com",
    port: parseInt(SMTP_PORT) || 587,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const now = new Date().toLocaleString();
  const mailOptions = {
    from: `"Skeepers Monitor" <${EMAIL_USER}>`,
    to: EMAIL_RECEIVER,
    subject: `✅ Monitor System Active`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f1f5f9; }
          .header { background: #10b981; padding: 24px; text-align: center; color: white; }
          .content { padding: 32px; }
          .table { width: 100%; border-collapse: collapse; }
          .table td { padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px; }
          .table td.val { text-align: right; color: #0f172a; font-weight: 600; }
          .footer { padding: 24px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px;">System Heartbeat</h1>
          </div>
          <div class="content">
            <table class="table">
              <tr><td>Last Check</td><td class="val">${now}</td></tr>
              <tr><td>Total Items Seen</td><td class="val">${stats.totalItems}</td></tr>
              <tr><td>Interval</td><td class="val">${stats.interval}s</td></tr>
              <tr><td>24h Scrapes</td><td class="val">${stats.scrapeCount}</td></tr>
            </table>
            <div style="margin-top: 32px; padding: 16px; background: #f0fdf4; border-radius: 8px; text-align: center; color: #166534; font-weight: 600; font-size: 14px;">
              System running smoothly
            </div>
          </div>
          <div class="footer">
            Skeepers Scraper Pro • Status Report
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Heartbeat email sent at ${now}`);
  } catch (error) {
    console.error("Error sending heartbeat:", error);
  }
}
