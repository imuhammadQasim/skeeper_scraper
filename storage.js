import fs from "fs/promises";
import { existsSync } from "fs";

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
 * @param {string} productData.id - Product/campaign ID
 * @param {string} productData.title - Product title
 * @param {string} productData.storeName - Store/brand name
 * @param {string} productData.link - Full URL to the product
 * @param {boolean} [productData.isSoldOut=false] - Whether the product is sold out
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
