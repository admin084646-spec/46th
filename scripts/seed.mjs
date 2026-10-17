// Idempotent seed runner for Mittal's Restaurant OS.
// Safe to re-run: it only inserts into tables that are still empty.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table) {
  const { count: c, error } = await db
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return c ?? 0;
}

/* ------------------------------- staff ---------------------------------- */

const STAFF = [
  ["Mittal Ji (Owner)", "owner", "$2b$10$Et7ohMWr8aTeiCpIwqmUj.Up/emdFcdHDVgDCuYnm2Ty2gwUrjyX.", { admin: true }],
  ["Front Desk (Cashier)", "admin", "$2b$10$GfIVG3lX8yqfLj7T/jUyM.KHg2xGk9Po9880ekLtbJWjEkcyeqJz6", {}],
  ["Ramesh (Waiter)", "waiter", "$2b$10$WpmnyRdkcDUm2d/k83XNeeR7prNFup9jQpoYoNo6Sc/JuT9JUzywS", {}],
  ["Suresh (Waiter)", "waiter", "$2b$10$7B1UbXWLHDvJhz1WlndH6u/MEvBT4eZOhYlkp6IJQi88QT1T4odgW", {}],
  ["Kitchen Head", "kitchen", "$2b$10$B8JCroM0CnrHJXTauHhhI.4gEAbGNW4.voMt7PbqLPRFQYg9Xhgka", {}],
  ["Kitchen Cook", "kitchen", "$2b$10$KC3lXoU/3EyJpwIdg2WufOSN65zeqjpQ4pk0FJ5PFcbCKgYkuFnx.", {}],
];

/* ----------------------------- categories -------------------------------- */

const CATEGORIES = [
  "Starters",
  "North Indian Main Course",
  "Roti and Breads",
  "Rice and Biryani",
  "South Indian",
  "Indo-Chinese",
  "Thali and Combos",
  "Desserts",
  "Beverages",
];

/* ------------------------------- items ---------------------------------- */

const ITEMS = [
  ["Starters", "Tomato Soup", "Classic tangy tomato shorba", 11000, 1],
  ["Starters", "Sweet Corn Soup", "Creamy sweet corn soup", 12000, 2],
  ["Starters", "Paneer Tikka", "Char-grilled marinated cottage cheese", 24000, 3],
  ["Starters", "Hara Bhara Kebab", "Spinach & green pea patties", 19000, 4],
  ["Starters", "Veg Spring Roll", "Crispy vegetable rolls", 18000, 5],
  ["Starters", "Crispy Corn", "Golden fried sweet corn tossed with spices", 20000, 6],
  ["North Indian Main Course", "Paneer Butter Masala", "Paneer in rich tomato-butter gravy", 29000, 1],
  ["North Indian Main Course", "Shahi Paneer", "Creamy royal paneer curry", 28000, 2],
  ["North Indian Main Course", "Kadai Paneer", "Paneer with peppers in kadai masala", 27000, 3],
  ["North Indian Main Course", "Palak Paneer", "Paneer in smooth spinach gravy", 25000, 4],
  ["North Indian Main Course", "Dal Makhani", "Slow-cooked black lentils with butter", 23000, 5],
  ["North Indian Main Course", "Dal Tadka", "Yellow dal tempered with ghee & spices", 18000, 6],
  ["North Indian Main Course", "Mix Veg", "Seasonal vegetables in spiced gravy", 22000, 7],
  ["North Indian Main Course", "Chole Masala", "Chickpeas in Punjabi masala", 19000, 8],
  ["North Indian Main Course", "Malai Kofta", "Paneer dumplings in creamy gravy", 26000, 9],
  ["North Indian Main Course", "Mushroom Masala", "Mushrooms in spiced onion-tomato gravy", 25000, 10],
  ["Roti and Breads", "Tandoori Roti", "Whole wheat roti from the tandoor", 2500, 1],
  ["Roti and Breads", "Butter Roti", "Tandoori roti brushed with butter", 3000, 2],
  ["Roti and Breads", "Butter Naan", "Soft naan finished with butter", 5000, 3],
  ["Roti and Breads", "Garlic Naan", "Naan topped with garlic & coriander", 7000, 4],
  ["Roti and Breads", "Lachha Paratha", "Flaky layered paratha", 6000, 5],
  ["Roti and Breads", "Stuffed Kulcha", "Kulcha stuffed with spiced filling", 9000, 6],
  ["Rice and Biryani", "Steamed Rice", "Plain steamed basmati rice", 13000, 1],
  ["Rice and Biryani", "Jeera Rice", "Basmati rice tempered with cumin", 16000, 2],
  ["Rice and Biryani", "Veg Pulao", "Fragrant rice with mixed vegetables", 19000, 3],
  ["Rice and Biryani", "Veg Dum Biryani", "Dum-cooked biryani with vegetables", 24000, 4],
  ["Rice and Biryani", "Peas Pulao", "Rice cooked with green peas", 18000, 5],
  ["South Indian", "Plain Dosa", "Crispy rice-lentil crepe", 11000, 1],
  ["South Indian", "Masala Dosa", "Dosa with spiced potato filling", 15000, 2],
  ["South Indian", "Mysore Masala Dosa", "Spicy Mysore-style dosa", 17000, 3],
  ["South Indian", "Idli Sambhar", "Steamed idlis with sambhar", 10000, 4],
  ["South Indian", "Medu Vada", "Crispy lentil doughnuts", 11000, 5],
  ["South Indian", "Uttapam", "Thick savoury pancake with toppings", 14000, 6],
  ["Indo-Chinese", "Veg Hakka Noodles", "Wok-tossed noodles with vegetables", 19000, 1],
  ["Indo-Chinese", "Veg Fried Rice", "Fried rice with mixed vegetables", 18000, 2],
  ["Indo-Chinese", "Veg Manchurian", "Veg balls in tangy Manchurian sauce", 21000, 3],
  ["Indo-Chinese", "Chilli Paneer", "Paneer tossed in spicy chilli sauce", 25000, 4],
  ["Indo-Chinese", "Veg Momos", "Steamed vegetable dumplings", 15000, 5],
  ["Thali and Combos", "Mini Veg Thali", "Assorted mini vegetarian platter", 22000, 1],
  ["Thali and Combos", "Punjabi Special Thali", "Grand Punjabi vegetarian platter", 32000, 2],
  ["Thali and Combos", "Dal Rice Combo", "Comforting dal with steamed rice", 18000, 3],
  ["Thali and Combos", "Chole Bhature", "Spiced chickpeas with fluffy bhature", 16000, 4],
  ["Desserts", "Gulab Jamun (2 Pieces)", "Soft milk dumplings in syrup", 8000, 1],
  ["Desserts", "Rasmalai (2 Pieces)", "Chilled cottage cheese in saffron milk", 11000, 2],
  ["Desserts", "Vanilla Ice Cream", "Classic vanilla scoop", 9000, 3],
  ["Desserts", "Gajar Ka Halwa", "Warm carrot halwa", 10000, 4],
  ["Beverages", "Sweet Lassi", "Chilled sweet yogurt drink", 9000, 1],
  ["Beverages", "Masala Chaas", "Spiced buttermilk", 5000, 2],
  ["Beverages", "Fresh Lime Soda", "Refreshing lime & soda", 7000, 3],
  ["Beverages", "Masala Tea", "Spiced Indian tea", 3500, 4],
  ["Beverages", "Cold Coffee", "Chilled blended coffee", 12000, 5],
];

/* -------------------------------- run ----------------------------------- */

async function main() {
  // staff
  if ((await count("staff")) === 0) {
    const { error } = await db.from("staff").insert(
      STAFF.map(([name, role, pin_hash, perms]) => ({
        name,
        role,
        pin_hash,
        perms,
      }))
    );
    if (error) throw new Error("staff insert: " + error.message);
    console.log(`✓ seeded ${STAFF.length} staff`);
  } else console.log("• staff already seeded");

  // categories
  let catMap = {};
  if ((await count("menu_categories")) === 0) {
    const { data, error } = await db
      .from("menu_categories")
      .insert(CATEGORIES.map((name, i) => ({ name, sort: i + 1 })))
      .select("id,name");
    if (error) throw new Error("categories insert: " + error.message);
    for (const c of data) catMap[c.name] = c.id;
    console.log(`✓ seeded ${data.length} categories`);
  } else {
    const { data } = await db.from("menu_categories").select("id,name");
    for (const c of data) catMap[c.name] = c.id;
    console.log("• categories already seeded");
  }

  // items
  if ((await count("menu_items")) === 0) {
    const rows = ITEMS.map(([cat, name, description, price_minor, sort]) => ({
      category_id: catMap[cat],
      name,
      description,
      price_minor,
      sort,
    }));
    if (rows.some((r) => !r.category_id))
      throw new Error("a menu item references a missing category");
    const { error } = await db.from("menu_items").insert(rows);
    if (error) throw new Error("items insert: " + error.message);
    console.log(`✓ seeded ${rows.length} menu items`);
  } else console.log("• menu items already seeded");

  // tables
  if ((await count("dining_tables")) === 0) {
    const rows = Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      return {
        label: `Table ${n}`,
        qr_token: `t${String(n).padStart(2, "0")}-${randomBytes(6).toString("hex")}`,
      };
    });
    const { error } = await db.from("dining_tables").insert(rows);
    if (error) throw new Error("tables insert: " + error.message);
    console.log(`✓ seeded ${rows.length} dining tables`);
  } else console.log("• dining tables already seeded");

  console.log("\nCounts:", {
    staff: await count("staff"),
    categories: await count("menu_categories"),
    items: await count("menu_items"),
    tables: await count("dining_tables"),
  });
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
