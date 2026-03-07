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

export async function sendEmailAlert(productName, productLink) {
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_RECEIVER) {
    console.warn("Email configuration missing. Skipping email alert.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_SERVER || "smtp.gmail.com",
    port: parseInt(SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Skeepers Monitor" <${EMAIL_USER}>`,
    to: EMAIL_RECEIVER,
    subject: `🚨 New Campaign: ${productName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background-color: #4f46e5; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Campaign Detected</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="color: #374151; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
            A new product campaign has just been published on Skeepers. Check the details below to ensure you don't miss out.
          </p>
          <div style="background-color: #f9fafb; border-left: 4px solid #4f46e5; padding: 15px; margin-bottom: 30px;">
            <p style="margin: 0; color: #111827; font-weight: 600; font-size: 18px;">${productName}</p>
          </div>
          <div style="text-align: center;">
            <a href="${productLink}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; transition: background-color 0.3s ease;">
              View Campaign Details
            </a>
          </div>
        </div>
        <div style="padding: 20px; background-color: #f3f4f6; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Sent automatically by Skeepers Monitoring System.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email alert sent for: ${productName}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

export async function sendTelegramAlert(productName, productLink) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram configuration missing. Skipping Telegram alert.");
    return;
  }

  const message = `🚨 *New Product Alert on Skeepers!*\n\n*Product:* ${productName}\n[View Product](${productLink})`;
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

export async function notifyNewProduct(productName, productLink) {
  await sendEmailAlert(productName, productLink);
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
    subject: `✅ System Healthy: Skeepers Monitor Status`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e7ff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #10b981; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">System Operational</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="color: #374151; font-size: 15px; margin-bottom: 25px;">
            This is a 24-hour status report confirming that your Skeepers monitor is active and tracking correctly.
          </p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280;">Last Check</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 600; text-align: right;">${now}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280;">Total Campaigns Seen</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 600; text-align: right;">${stats.totalItems}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280;">Cycle Frequency</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 600; text-align: right;">Every ${stats.interval}s</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280;">Checks in last 24h</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: 600; text-align: right;">${stats.scrapeCount}</td>
            </tr>
          </table>

          <div style="background-color: #ecfdf5; padding: 12px; border-radius: 6px; text-align: center;">
            <p style="margin: 0; color: #065f46; font-size: 14px; font-weight: 500;">
              Status: System is working within normal parameters.
            </p>
          </div>
        </div>
        <div style="padding: 15px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 11px;">
            Skeepers Monitor • ${new Date().getFullYear()}
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Heartbeat email sent at ${now}`);
  } catch (error) {
    console.error("Error sending heartbeat:", error);
  }
}
