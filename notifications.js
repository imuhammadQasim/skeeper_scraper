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
    secure: false, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: EMAIL_RECEIVER,
    subject: `🚨 New Product Alert: ${productName}`,
    text: `A new product has been detected on Skeepers!\n\nName: ${productName}\nLink: ${productLink}`,
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
  // Current preference: Email first.
  await sendEmailAlert(productName, productLink);

  // To enable Telegram, uncomment the line below:
  // await sendTelegramAlert(productName, productLink);
}
