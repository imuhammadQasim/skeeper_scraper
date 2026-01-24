import fs from "fs/promises";
import { existsSync } from "fs";

const DB_FILE = "seen_products.json";
const BACKUP_FILE = "seen_products.backup.json";

async function migrateDatabase() {
  console.log("🔄 Migrating seen_products.json to new format...\n");

  if (!existsSync(DB_FILE)) {
    console.log("✅ No existing database found. Nothing to migrate.");
    return;
  }

  try {
    // Read existing file
    const data = await fs.readFile(DB_FILE, "utf-8");
    const oldData = JSON.parse(data);

    // Create backup
    await fs.writeFile(BACKUP_FILE, data);
    console.log(`📦 Backup created: ${BACKUP_FILE}`);

    // Check if already in new format
    if (
      Array.isArray(oldData) &&
      oldData.length > 0 &&
      typeof oldData[0] === "object" &&
      oldData[0].id
    ) {
      console.log("✅ Database is already in the new format!");
      return;
    }

    // Migrate from old format (array of IDs) to new format (array of objects)
    const newData = oldData.map((id) => ({
      id: id,
      title: "Unknown (migrated)",
      storeName: "Unknown",
      link: `https://creator.im.skeepers.io/campaigns/${id}`,
      firstSeen: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
    }));

    // Save new format
    await fs.writeFile(DB_FILE, JSON.stringify(newData, null, 2));
    console.log(`✅ Migrated ${newData.length} products to new format!`);
    console.log("\n📝 New format includes:");
    console.log("   - Product ID");
    console.log("   - Product Title");
    console.log("   - Store Name");
    console.log("   - Product Link");
    console.log("   - First Seen Timestamp");
    console.log("   - Last Checked Timestamp");
  } catch (error) {
    console.error("❌ Error during migration:", error);
  }
}

migrateDatabase();
