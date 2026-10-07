const Database = require("better-sqlite3");

const db = new Database("products.db");

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      products TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saved_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS liked_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Database initialized successfully.");
}


// =========================
// HISTORY
// =========================

function saveHistory(products, result) {
  const stmt = db.prepare(`
    INSERT INTO history (products, result)
    VALUES (?, ?)
  `);

  return stmt.run(
    JSON.stringify(products),
    JSON.stringify(result)
  );
}

function getHistory() {
  return db
    .prepare(`
      SELECT *
      FROM history
      ORDER BY created_at DESC
    `)
    .all();
}

function clearHistory() {
  return db
    .prepare(`DELETE FROM history`)
    .run();
}


// =========================
// SAVED PRODUCTS
// =========================

function saveProduct(product) {
  const stmt = db.prepare(`
    INSERT INTO saved_products (product)
    VALUES (?)
  `);

  return stmt.run(JSON.stringify(product));
}

function getSavedProducts() {
  return db
    .prepare(`
      SELECT *
      FROM saved_products
      ORDER BY created_at DESC
    `)
    .all();
}

function deleteSavedProduct(id) {
  return db
    .prepare(`
      DELETE FROM saved_products
      WHERE id = ?
    `)
    .run(id);
}


// =========================
// LIKED PRODUCTS
// =========================

function saveLikedProduct(product) {
  const stmt = db.prepare(`
    INSERT INTO liked_products (product)
    VALUES (?)
  `);

  return stmt.run(JSON.stringify(product));
}

function getLikedProducts() {
  return db
    .prepare(`
      SELECT *
      FROM liked_products
      ORDER BY created_at DESC
    `)
    .all();
}

function deleteLikedProduct(id) {
  return db
    .prepare(`
      DELETE FROM liked_products
      WHERE id = ?
    `)
    .run(id);
}


// =========================
// EXPORTS
// =========================

module.exports = {
  db,
  initDatabase,

  saveHistory,
  getHistory,
  clearHistory,

  saveProduct,
  getSavedProducts,
  deleteSavedProduct,

  saveLikedProduct,
  getLikedProducts,
  deleteLikedProduct,
};