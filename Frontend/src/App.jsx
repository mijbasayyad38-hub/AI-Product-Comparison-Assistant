 import React, { useEffect, useState } from "react";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL ||
  "https://ai-product-comparison-assistant.onrender.com";

const FALLBACK =
  "https://dummyimage.com/600x400/e9e7ff/5b4bd8&text=Product";

const clean = (value, fallback = "Not available") => {
  if (value === null || value === undefined) return fallback;

  let text = String(value).trim();

  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    "$1"
  );

  text = text.replace(/\*\*|__|###|##|#/g, "");
  text = text.replace(/\\([*_#[\]()&])/g, "$1");

  return text.trim() || fallback;
};

const imageUrl = (value) => {
  if (!value) return FALLBACK;

  const text = String(value).trim();

  const markdown = text.match(
    /\[.*?\]\((https?:\/\/[^)]+)\)/i
  );

  if (markdown) return markdown[1];

  return /^https?:\/\//i.test(text)
    ? text
    : FALLBACK;
};

const money = (value) => {
  const number = Number(value);

  if (!number || number <= 0) return "Not available";

  return `₹${number.toLocaleString("en-IN")}`;
};

const parseData = (value) => {
  let result = value;

  for (let i = 0; i < 4; i++) {
    if (typeof result !== "string") break;

    try {
      result = JSON.parse(result);
    } catch {
      break;
    }
  }

  return result;
};

const normalizeProduct = (product = {}) => {
  product = parseData(product) || {};

  return {
    ...product,
    name: clean(
      product.name ||
        product.title ||
        product.productName,
      "Product"
    ),
    brand: clean(product.brand, "Unknown"),
    platform: clean(
      product.platform || product.store,
      "Store"
    ),
    price: Number(product.price) || 0,
    rating: Number(product.rating) || 0,
    image: imageUrl(
      product.image ||
        product.imageUrl ||
        product.thumbnail
    ),
    availability: clean(
      product.availability,
      "Availability unknown"
    ),
    specifications:
      parseData(product.specifications) || {},
    scores: parseData(product.scores) || {},
    
const displayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${displayValue(item)}`)
      .join(" · ");
  }
  return String(value);
};

const getSpecificationEntries = (product) => {
  const parsed = parseData(product?.specifications);
  if (Array.isArray(parsed)) {
    return parsed.reduce((acc, item) => {
      if (item && typeof item === "object") {
        const key = item.name || item.key || item.label;
        if (key) acc[String(key)] = item.value ?? item.details ?? item.specification;
      }
      return acc;
    }, {});
  }
  return parsed && typeof parsed === "object" ? parsed : {};
};

function ProductCard({
  product,
  best,
  onSave,
  onLike,
}) {
  const p = normalizeProduct(product);

  return (
    <article
      className={`product-card ${
        best ? "best-product" : ""
      }`}
    >
      {best && (
        <div className="best-label">
          ★ AI RECOMMENDED
        </div>
      )}

      <div className="product-image-box">
        <img
          src={p.image}
          alt={p.name}
          onError={(e) => {
            e.currentTarget.src = FALLBACK;
          }}
        />
      </div>

      <div className="product-card-body">
        <div className="product-store">
          <span>{p.platform}</span>
          <span>{p.brand}</span>
        </div>

        <h3>{p.name}</h3>

        <div className="product-price-row">
          <strong>{money(p.price)}</strong>

          <span className="rating">
            ★ {p.rating ? p.rating.toFixed(1) : "N/A"}
          </span>
        </div>
            </article>
  );
}

function CollectionCard({
  item,
  onDelete,
}) {
  const product = normalizeProduct(
    item?.product || item
  );

  return (
    <article className="collection-card-new">
      <div className="collection-img">
        <img
          src={product.image}
          alt={product.name}
          onError={(e) => {
            e.currentTarget.src = FALLBACK;
          }}
        />
      </div>

      <div className="collection-content">
        <span className="collection-store">
          {product.platform}
        </span>

        <h3>{product.name}</h3>

        <div className="collection-price">
          {money(product.price)}
          <span>
            ★ {product.rating || "N/A"}
          </span>
        </div>
      </div>

      {item?.id && (
        <button
          className="delete-btn"
          onClick={() => onDelete(item.id)}
        >
          ×
        </button>
      )}
    </article>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [dark, setDark] = useState(false);

  const [url1, setUrl1] = useState("");
  const [url2, setUrl2] = useState("");

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);
  const [liked, setLiked] = useState([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("compareai-theme");

    setDark(savedTheme === "dark");

    loadAll();
  }, []);

  useEffect(() => {
    document.body.className = dark
      ? "dark"
      : "";

    localStorage.setItem(
      "compareai-theme",
      dark ? "dark" : "light"
    );
  }, [dark]);

  async function loadAll() {
    await Promise.all([
      loadHistory(),
      loadSaved(),
      loadLiked(),
    ]);
  }

      setLiked(
        Array.isArray(data)
          ? data
          : data.products || []
      );
    } catch (error) {
      console.log(error.message);
    }
  }

  async function compare() {
    setMessage("");

    if (!url1.trim() || !url2.trim()) {
      setMessage(
        "Please enter both product URLs."
      );
      return;
    }

    setLoading(true);

    try {
      const data = await request(
        "/api/compare",
        {
          method: "POST",
          body: JSON.stringify({
            products: [
              url1.trim(),
              url2.trim(),
            ],
            requirement: "",
          }),
        }
      );

      setResult(
        data.comparison ||
          data.result ||
          data
      );

      await loadHistory();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProduct(product) {
    try {
      await request("/api/saved", {
        method: "POST",
        body: JSON.stringify({
          product: normalizeProduct(product),
        }),
      });

      await loadSaved();
      setMessage("Product saved successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function likeProduct(product) {
    try {
      await request("/api/liked", {
        method: "POST",
        body: JSON.stringify({
          product: normalizeProduct(product),
        }),
      });

      await loadLiked();
      setMessage("Product liked successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteSaved(id) {
    try {
      await request(`/api/saved/${id}`, {
        method: "DELETE",
      });
      <header className="main-navbar">
        <button
          className="logo-area"
          onClick={() =>
            setPage("dashboard")
          }
        >
          <span className="logo-box">
            AI
          </span>

          <span className="logo-text">
            <strong>ProductIQ</strong>
            <small>
              AI Product Comparison
            </small>
          </span>
        </button>

        <nav className="main-nav">
          <button
            className={
              page === "dashboard"
                ? "active"
                : ""
            }
            onClick={() =>
              setPage("dashboard")
            }
          >
            Dashboard
          </button>

          <button
            className={
              page === "compare"
                ? "active"
                : ""
            }
            onClick={() =>
              setPage("compare")
            }
          >
            Compare
          </button>

          <button
            className={
              page === "saved"
                ? "active"
                : ""
            }
            onClick={() =>
              setPage("saved")
            }
          >
            Saved
          </button>

          <button
            className={
              page === "liked"
                ? "active"
                : ""
            }
            onClick={() =>
              setPage("liked")
            }
          >
            Liked
          </button>

          <button
            className={
              page === "history"
                ? "active"
                : ""
            }
            onClick={() =>
              setPage("history")
            }
          >
            History
          </button>
        </nav>
                specifications, ratings and
                AI-powered recommendations.
              </p>

              <div className="hero-buttons">
                <button
                  className="primary-btn"
                  onClick={() =>
                    setPage("compare")
                  }
                >
                  Start Comparing →
                </button>

                <button
                  className="outline-btn"
                  onClick={() =>
                    setPage("history")
                  }
                >
                  View History
                </button>
              </div>

              <div className="hero-trust">
                <span>✓ Amazon</span>
                <span>✓ Flipkart</span>
                <span>✓ AI Analysis</span>
              </div>
            </div>

            <div className="hero-right">
              <div className="hero-glow" />

              <div className="dashboard-card">
                <div className="mini-header">
                  <span>
                    AI Comparison
                  </span>
                  <span className="online">
                    ● Live
                  </span>
                </div>

                <div className="mini-product">
                  <div className="mini-image">
                    💻
                  </div>

                  <div>
                    <strong>
                      Product Analysis
                    </strong>
                    <small>
                      Price • Specs • Rating
                    </small>
                  </div>

                  <b>92</b>
                </div>

                <div className="mini-bars">
                  <div>
                    <span>Price</span>
                    <i>
                      <em style={{ width: "82%" }} />
                    </i>
                  </div>

                  <div>
                    <span>Specs</span>
                    <i>
                      <em style={{ width: "94%" }} />
                    </i>
                  </div>

                  <div>
                    <span>Rating</span>
                    <i>
                      <em style={{ width: "90%" }} />
                    </i>
                  </div>
                </div>

                <div className="mini-result">
                  <span>✦</span>
                  AI recommends the best value
                </div>
              </div>
              </div>

              <div className="floating-card rating-float">
                <b>★</b>
                <span>
                  Highest
                  <strong>Rated</strong>
                </span>
              </div>
            </div>
          </section>

          <section className="content-section">

            <div className="section-title">
              <span>WHY PRODUCTIQ</span>
              <h2>
                Everything you need to decide.
              </h2>
              <p>
                One place to compare,
                understand and choose.
              </p>
            </div>

            <div className="feature-grid-new">

              <div className="feature-card-new">
                <div>🔗</div>
                <h3>
                  Multi-Store Comparison
                </h3>
                <p>
                  Compare Amazon and Flipkart
                  products side by side.
                </p>
              </div>

              <div className="feature-card-new">
                <div>📊</div>
                <h3>
                  Smart Scoring
                </h3>
                <p>
                  Price, specifications and
                  ratings are scored together.
                </p>
              </div>

              <div className="feature-card-new">
                <div>🤖</div>
                <h3>
                  AI Recommendation
                </h3>
                <p>
                  Get a simple recommendation
                  based on your requirement.
                </p>
              </div>

              <div className="feature-card-new">
                <div>💾</div>
                <h3>
                  Save & Like
                </h3>
                <p>
                  Keep interesting products
                  for later.
                </p>
              </div>

            </div>
          </section>
        </main>
      )}
  {/* COMPARE */}

      {page === "compare" && (
        <main className="content-page">

          <div className="page-heading">
            <span>PRODUCT COMPARISON</span>
            <h1>
              Find your
              <br />
              <strong>best match.</strong>
            </h1>
            <p>
              Add two product URLs and let
              ProductIQ compare them.
            </p>
          </div>

          <section className="compare-panel">

            <div className="panel-heading">
              <div className="step-number">
                01
              </div>

              <div>
                <h2>
                  Add Products
                </h2>
                <p>
                  Paste Amazon or Flipkart
                  product links.
                </p>
              </div>
            </div>

            <div className="url-columns">

              <div className="url-box">
                <label>
                  PRODUCT 01
                </label>

                <div className="url-input">
                  <span className="amazon">
                    A
                  </span>

                  <input
                    value={url1}
                    onChange={(e) =>
                      setUrl1(e.target.value)
                    }
                    placeholder="Paste Amazon / Flipkart URL"
                  />
                </div>
              </div>
                                  ANALYSIS COMPLETE
                  </span>

                  <h2>
                    Your comparison
                  </h2>
                </div>

                <div className="ai-pill">
                  ● AI Powered
                </div>
              </div>

              <div className="winner-card">

                <div className="winner-icon">
                  🏆
                </div>

                <div className="winner-info">
                  <span>
                    RECOMMENDED PRODUCT
                  </span>

                  <h2>
                    {clean(
                      best.name,
                      "Best Product"
                    )}
                  </h2>

                  <p>
                    {clean(
                      recommendation,
                      "This product provides the best overall value."
                    )}
                  </p>
                </div>

                <div className="winner-score">
                  <strong>
                    {Math.round(
                      Number(best.score) || 0
                    )}
                  </strong>
                  <span>/100</span>
                  <small>
                    Overall Score
                  </small>
                </div>

              </div>

              <div className="stats-row">

                <div>
                  <span>CHEAPEST</span>
                  <strong>
                    {money(
                      result?.cheapestProduct
                        ?.price
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    HIGHEST RATED
                  </span>
                  <strong>
                    {result
                      ?.highestRatedProduct
                      ?.rating || "N/A"}
                    ★
                  </strong>
                </div>

              <section className="comparison-table-section" aria-labelledby="comparison-table-title">
                <div className="products-heading">
                  <div>
                    <span>SPECIFICATION BREAKDOWN</span>
                    <h2 id="comparison-table-title">Comparison Table</h2>
                  </div>
                </div>
                {products.length < 2 ? (
                  <div className="comparison-table-empty">
                    Product specifications could not be displayed because the server returned fewer than two products.
                  </div>
                ) : (
                  <div className="comparison-table-wrap">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th scope="col">Feature</th>
                          {products.map((product, index) => (
                            <th scope="col" key={`table-head-${index}`}>
                              {normalizeProduct(product).name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Brand", get: (p) => p.brand },
                          { label: "Store / Platform", get: (p) => p.platform || p.store },
                          { label: "Price", get: (p) => p.price ? money(p.price) : "Not available" },
                          { label: "Rating", get: (p) => p.rating ? `★ ${p.rating}` : "Not available" },
                          { label: "Availability", get: (p) => p.availability },
                          ...Array.from(
                            new Set(
                              products.flatMap((product) =>
                                Object.keys(getSpecificationEntries(product))
                              )
                            )
                          ).sort((a, b) => a.localeCompare(b)).map((key) => ({
                            label: key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
                            get: (p) => getSpecificationEntries(p)[key]
                          }))
                        ].map((row, rowIndex) => (
                          <tr key={`table-row-${rowIndex}`}>
                            <th scope="row">{row.label}</th>
                            {products.map((product, productIndex) => {
                              const normalized = normalizeProduct(product);
                              const raw = row.get(product);
                              const value = row.label === "Brand" ? normalized.brand
                                : row.label === "Store / Platform" ? normalized.platform
                                : row.label === "Price" ? (normalized.price ? money(normalized.price) : "Not available")
                                : row.label === "Rating" ? (normalized.rating ? `★ ${normalized.rating}` : "Not available")
                                : row.label === "Availability" ? normalized.availability
                                : raw;
                              return (
                                <td key={`table-cell-${rowIndex}-${productIndex}`}>
                                  {displayValue(value)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div className="recommendation-box">
                <div className="recommendation-icon">
                  ✦
                </div>

                <div>
                  <span>
                    AI RECOMMENDATION
                  </span>

                  <h3>
                    What should you choose?
                  </h3>

                  <p>
                    {clean(
                      recommendation
                    )}
                  </p>
                </div>
              </div>

              <section className="comparison-table-section" aria-labelledby="comparison-table-title">
                <div className="products-heading">
                  <div>
                    <span>SPECIFICATION BREAKDOWN</span>
                    <h2 id="comparison-table-title">Comparison Table</h2>
                  </div>
                </div>
                {products.length < 2 ? (
                  <div className="comparison-table-empty">
                    Product specifications could not be displayed because the server returned fewer than two products.
                  </div>
                ) : (
                  <div className="comparison-table-wrap">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th scope="col">Feature</th>
                          {products.map((product, index) => (
                            <th scope="col" key={`table-head-${index}`}>
                              {normalizeProduct(product).name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Brand", get: (p) => p.brand },
                          { label: "Store / Platform", get: (p) => p.platform || p.store },
                          { label: "Price", get: (p) => p.price ? money(p.price) : "Not available" },
                          { label: "Rating", get: (p) => p.rating ? `★ ${p.rating}` : "Not available" },
                          { label: "Availability", get: (p) => p.availability },
                          ...Array.from(
                            new Set(
                              products.flatMap((product) =>
                                Object.keys(getSpecificationEntries(product))
                              )
                            )
                          ).sort((a, b) => a.localeCompare(b)).map((key) => ({
                            label: key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
                            get: (p) => getSpecificationEntries(p)[key]
                          }))
                        ].map((row, rowIndex) => (
                          <tr key={`table-row-${rowIndex}`}>
                            <th scope="row">{row.label}</th>
                            {products.map((product, productIndex) => {
                              const normalized = normalizeProduct(product);
                              const raw = row.get(product);
                              const value = row.label === "Brand" ? normalized.brand
                                : row.label === "Store / Platform" ? normalized.platform
                                : row.label === "Price" ? (normalized.price ? money(normalized.price) : "Not available")
                                : row.label === "Rating" ? (normalized.rating ? `★ ${normalized.rating}` : "Not available")
                                : row.label === "Availability" ? normalized.availability
                                : raw;
                              return (
                                <td key={`table-cell-${rowIndex}-${productIndex}`}>
                                  {displayValue(value)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div className="recommendation-box">
                <div className="recommendation-icon">
                  ✦
                </div>

                <div>
                  <span>
                    AI RECOMMENDATION
                  </span>

                  <h3>
                    What should you choose?
                  </h3>

                  <p>
                    {clean(
                      recommendation
                    )}
                  </p>
                </div>
              </div>

              <section className="comparison-table-section" aria-labelledby="comparison-table-title">
                <div className="products-heading">
                  <div>
                    <span>SPECIFICATION BREAKDOWN</span>
                    <h2 id="comparison-table-title">Comparison Table</h2>
                  </div>
                </div>
                {products.length < 2 ? (
                  <div className="comparison-table-empty">
                    Product specifications could not be displayed because the server returned fewer than two products.
                  </div>
                ) : (
                  <div className="comparison-table-wrap">
                    <table className="comparison-table">
                      <thead>
                        <tr>
                          <th scope="col">Feature</th>
                          {products.map((product, index) => (
                            <th scope="col" key={`table-head-${index}`}>
                              {normalizeProduct(product).name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Brand", get: (p) => p.brand },
                          { label: "Store / Platform", get: (p) => p.platform || p.store },
                          { label: "Price", get: (p) => p.price ? money(p.price) : "Not available" },
                          { label: "Rating", get: (p) => p.rating ? `★ ${p.rating}` : "Not available" },
                          { label: "Availability", get: (p) => p.availability },
                          ...Array.from(
                            new Set(
                              products.flatMap((product) =>
                                Object.keys(getSpecificationEntries(product))
                              )
                            )
                          ).sort((a, b) => a.localeCompare(b)).map((key) => ({
                            label: key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
                            get: (p) => getSpecificationEntries(p)[key]
                          }))
                        ].map((row, rowIndex) => (
                          <tr key={`table-row-${rowIndex}`}>
                            <th scope="row">{row.label}</th>
                            {products.map((product, productIndex) => {
                              const normalized = normalizeProduct(product);
                              const raw = row.get(product);
                              const value = row.label === "Brand" ? normalized.brand
                                : row.label === "Store / Platform" ? normalized.platform
                                : row.label === "Price" ? (normalized.price ? money(normalized.price) : "Not available")
                                : row.label === "Rating" ? (normalized.rating ? `★ ${normalized.rating}` : "Not available")
                                : row.label === "Availability" ? normalized.availability
                                : raw;
                              return (
                                <td key={`table-cell-${rowIndex}-${productIndex}`}>
                                  {displayValue(value)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div className="recommendation-box">
                <div className="recommendation-icon">
                  ✦
                </div>

                <div>
                  <span>
                    AI RECOMMENDATION
                  </span>

                  <h3>
                    What should you choose?
                  </h3>

                  <p>
                    {clean(
                      recommendation
                    )}
                  </p>
                </div>
              </div>
                <div>
                  <span>SPECIFICATIONS</span>
                  <strong>40%</strong>
                </div>

                <div>
                  <span>RATING</span>
                  <strong>20%</strong>
                </div>

                <div>
                  <span>DATA CONFIDENCE</span>
                  <strong>15%</strong>
                </div>
              </div>

            </section>
          )}
        </main>
      )}

      {/* SAVED */}

      {page === "saved" && (
        <main className="content-page">

          <div className="page-heading">
            <span>SAVED PRODUCTS</span>
            <h1>
              Your saved
              <br />
              <strong>products.</strong>
            </h1>
            <p>
              Products you want to keep for
              later.
            </p>
          </div>

          {saved.length === 0 ? (
            <div className="empty-state">
              <div>♡</div>
              <h2>
                No saved products
              </h2>
              <p>
                Save products from the
                comparison page.
              </p>
              <button
                className="primary-btn"
                onClick={() =>
                  setPage("compare")
                }
              >
                Compare Products →
              </button>
            </div>
          ) : (
            <div className="collection-grid-new">
              {saved.map(
                (item, index) => (
                  <CollectionCard
                    key={
                      item.id || index
                    }
                    item={item}
                    onDelete={
                      deleteSaved
                    }
                  />
                )
              )}
            </div>
          )}
        </main>
      )}
          {liked.length === 0 ? (
            <div className="empty-state">
              <div>♥</div>
              <h2>
                No liked products
              </h2>
              <p>
                Like products from your
                comparison results.
              </p>
              <button
                className="primary-btn"
                onClick={() =>
                  setPage("compare")
                }
              >
                Compare Products →
              </button>
            </div>
          ) : (
            <div className="collection-grid-new">
              {liked.map(
                (item, index) => (
                  <CollectionCard
                    key={
                      item.id || index
                    }
                    item={item}
                    onDelete={
                      deleteLiked
                    }
                  />
                )
              )}
            </div>
          )}
        </main>
      )}

      {/* HISTORY */}

      {page === "history" && (
        <main className="content-page">

          <div className="history-header">
            <div className="page-heading">
              <span>
                COMPARISON HISTORY
              </span>
              <h1>
                Your recent
                <br />
                <strong>comparisons.</strong>
              </h1>
            </div>

            {history.length > 0 && (
              <button
                className="clear-btn"
                onClick={clearHistory}
              >
                Clear History
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="empty-state">
              <div>◷</div>
              <h2>
                No comparison history
              </h2>
              <p>
                Your comparisons will appear
                here automatically.
              </p>
              <button
                className="primary-btn"
                onClick={() =>
                  setPage("compare")
                }
              >
                 Start Comparing →
              </button>
            </div>
          ) : (
            <div className="history-list-new">
              {history.map(
                (item, index) => (
                  <div
                    className="history-row"
                    key={
                      item.id || index
                    }
                  >
                    <div className="history-number">
                      {String(
                        index + 1
                      ).padStart(2, "0")}
                    </div>

                    <div className="history-details">
                      <h3>
                        {historyTitle(item)}
                      </h3>

                      <span>
                        {item.created_at ||
                          "Previous comparison"}
                      </span>
                    </div>

                    <div className="history-check">
                      ✓
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </main>
      )}

      <footer className="main-footer">
        <div>
          <strong>
            ProductIQ
          </strong>
          <span>
            AI Product Comparison Assistant
          </span>
        </div>

        <p>
          B.Sc. Artificial Intelligence
        </p>
      </footer>
    </div>
  );
}
