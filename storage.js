import fs from "fs/promises";
import { existsSync } from "fs";

const DATA_DIR = "./data";
const SEEN_CAMPAIGNS_FILE = `${DATA_DIR}/seenCampaigns.json`;

/**
 * Initialize data directory
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Load seen campaign IDs from JSON file
 * Returns an array of strings
 */
export async function loadSeenCampaigns() {
  await ensureDataDir();
  if (!existsSync(SEEN_CAMPAIGNS_FILE)) {
    return [];
  }
  try {
    const data = await fs.readFile(SEEN_CAMPAIGNS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading seen campaigns:", error);
    return [];
  }
}

/**
 * Save seen campaign IDs to JSON file
 * @param {Array} ids - Array of campaign ID strings
 */
export async function saveSeenCampaigns(ids) {
  try {
    await ensureDataDir();
    await fs.writeFile(SEEN_CAMPAIGNS_FILE, JSON.stringify(ids, null, 2));
  } catch (error) {
    console.error("Error saving seen campaigns:", error);
  }
}

// Keep the old functions for backward compatibility if needed, but update DB_FILE path if necessary
// (Assuming the user might still want to use the old system for something else or I'll just keep them for now)
const DB_FILE = "seen_products.json";

/**
 * Load seen products from JSON file
 * Returns an array of product objects with metadata
 */
export async function loadSeenProducts() {
  if (!existsSync(DB_FILE)) {
    return [];
  }
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading database:", error);
    return [];
  }
}

/**
 * Save seen products to JSON file
 * @param {Array} seenProducts - Array of product objects
 */
export async function saveSeenProducts(seenProducts) {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(seenProducts, null, 2));
  } catch (error) {
    console.error("Error saving database:", error);
  }
}

/**
 * Check if a product ID already exists in the database
 * @param {string} productId - The product/campaign ID to check
 * @param {Array} seenProducts - Array of seen product objects
 * @returns {boolean} - True if new, false if already seen
 */
export function isNewProduct(productId, seenProducts) {
  return !seenProducts.some((product) => product.id === productId);
}

/**
 * Add a new product to the seen products list
 * @param {Array} seenProducts - Current array of seen products
 * @param {Object} productData - Product data to add
 * @returns {Array} - Updated array with new product
 */
export function addProduct(seenProducts, productData) {
  const newProduct = {
    id: productData.id,
    title: productData.title,
    storeName: productData.storeName || "Unknown Store",
    link: productData.link,
    isSoldOut: productData.isSoldOut || false,
    firstSeen: new Date().toISOString(),
    lastChecked: new Date().toISOString(),
  };

  return [...seenProducts, newProduct];
}

/**
 * Update the lastChecked timestamp for all products
 * @param {Array} seenProducts - Array of product objects
 * @returns {Array} - Updated array with new timestamps
 */
export function updateLastChecked(seenProducts) {
  const now = new Date().toISOString();
  return seenProducts.map((product) => ({
    ...product,
    lastChecked: now,
  }));
}

/**
 * Append a detailed detection event to a debug log for future analysis
 * @param {Object} event - Detailed event data
 */
export async function logDetectionDebug(event) {
  try {
    await ensureDataDir();
    const logFile = `${DATA_DIR}/detection_debug.log`;
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ID: ${event.id} | Product: ${event.name} | Status: ${event.status} | SoldOut: ${event.soldOut} | Lag: ${event.lag}s | Page: ${event.page}\n`;
    await fs.appendFile(logFile, entry);
  } catch (error) {
    console.error("Error writing to detection debug log:", error);
  }
}
