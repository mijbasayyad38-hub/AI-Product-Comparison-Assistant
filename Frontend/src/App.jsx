import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://ai-product-comparison-assistant.onrender.com";

const FALLBACK_IMAGE =
  "https://dummyimage.com/600x400/e5e7eb/6b7280&text=Product+Image";

/* =========================
   HELPERS
========================= */

function cleanText(value, fallback = "Not available") {
  if (value === null || value === undefined) return fallback;

  let text = String(value).trim();

  // Markdown links
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi,
    "$1"
  );

  // Markdown formatting
  text = text.replace(/(\*\*|\*|__|_|###|##|#)/g, "");

  // Escaped markdown characters
  text = text.replace(/\\([*_#[\]()&])/g, "$1");

  return text.trim() || fallback;
}

function cleanImage(value) {
  if (!value) return "";

  let text = String(value).trim();

  const match = text.match(
    /\[[^\]]*\]\((https?:\/\/[^)]+)\)/i
  );

  if (match) return match[1];

  text = text.replace(/^["'`]+|["'`]+$/g, "");

  return /^https?:\/\//i.test(text) ? text : "";
}

function parseJSON(value) {
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
}

function normalizeProduct(product) {
  product = parseJSON(product);

  if (!product || typeof product !== "object") {
    return {
      name: cleanText(product, "Product"),
      brand: "Unknown",
      platform: "Store",
      price: 0,
      rating: 0,
      image: "",
      availability: "Unknown",
      specifications: {},
      scores: {},
    };
  }

  return {
    ...product,
    name: cleanText(
      product.name ||
        product.title ||
        product.productName,
      "Product"
    ),
    brand: cleanText(product.brand, "Unknown"),
    platform: cleanText(
      product.platform || product.store,
      "Store"
    ),
    price: Number(product.price) || 0,
    rating: Number(product.rating) || 0,
    image: cleanImage(
      product.image ||
        product.imageUrl ||
        product.thumbnail
    ),
    availability: cleanText(
      product.availability,
      "Availability unknown"
    ),
    specifications:
      parseJSON(product.specifications) || {},
    scores: parseJSON(product.scores) || {},
  };
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "Not available";
  return `₹${n.toLocaleString("en-IN")}`;
}

function rating(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "N/A";
  return n.toFixed(1);
}

function getProducts(data) {
  const products =
    data?.comparison?.products ||
    data?.result?.products ||
    data?.products ||
    [];

  return Array.isArray(products)
    ? products.map(normalizeProduct)
    : [];
}

/* =========================
   IMAGE
========================= */

function ProductImage({ src, alt = "Product" }) {
  const [image, setImage] = useState(
    cleanImage(src) || FALLBACK_IMAGE
  );

  useEffect(() => {
    setImage(cleanImage(src) || FALLBACK_IMAGE);
  }, [src]);

  return (
    <img
      src={image}
      alt={alt}
      onError={() => setImage(FALLBACK_IMAGE)}
    />
  );
}

/* =========================
   API
========================= */

async function apiRequest(url, options = {}) {
  const response = await fetch(
    `${API_BASE}${url}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    }
  );

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed: ${response.status}`
    );
  }

  return data;
}

/* =========================
   PRODUCT CARD
========================= */

function ProductCard({
  product,
  winner,
  cheapest,
  highestRated,
  onSave,
  onLike,
}) {
  const p = normalizeProduct(product);

  const score =
    Number(
      p.scores?.overall ??
        p.scores?.overallScore ??
        0
    ) || 0;

  return (
    <div
      className={
        winner
          ? "result-product-card winner-product"
          : "result-product-card"
      }
    >
      <div className="product-badges">
        {winner && (
          <span className="winner-badge">
            🏆 BEST CHOICE
          </span>
        )}

        {cheapest && (
          <span className="price-badge">
            💰 CHEAPEST
          </span>
        )}

        {highestRated && (
          <span className="rating-badge">
            ⭐ HIGHEST RATED
          </span>
        )}
      </div>

      <div className="result-image">
        <ProductImage
          src={p.image}
          alt={p.name}
        />
      </div>

      <div className="result-product-info">
        <div className="store-row">
          <span>{p.platform}</span>
          <span>{p.brand}</span>
        </div>

        <h3>{p.name}</h3>

        <div className="price-rating-row">
          <strong>{money(p.price)}</strong>

          <span className="rating-pill">
            ★ {rating(p.rating)}
          </span>
        </div>

        <div className="availability">
          <span className="availability-dot" />
          {p.availability}
        </div>

        <div className="score-mini">
          <div>
            <span>Overall Score</span>
            <strong>
              {Math.round(score)}/100
            </strong>
          </div>

          <div className="score-bar">
            <span
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, score)
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="card-actions">
          <button
            className="save-card-button"
            onClick={() => onSave(p)}
          >
            ♡ Save
          </button>

          <button
            className="like-card-button"
            onClick={() => onLike(p)}
          >
            ♥ Like
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   COLLECTION CARD
========================= */

function CollectionCard({ item, onDelete }) {
  let product =
    item?.product || item;

  product = normalizeProduct(product);

  return (
    <div className="collection-card">
      <div className="collection-image">
        <ProductImage
          src={product.image}
          alt={product.name}
        />
      </div>

      <div className="collection-info">
        <span className="store-label">
          {product.platform}
        </span>

        <h3>{product.name}</h3>

        <div className="collection-meta">
          <strong>
            {money(product.price)}
          </strong>

          <span>
            ★ {rating(product.rating)}
          </span>
        </div>
      </div>

      {onDelete && (
        <button
          className="remove-button"
          onClick={onDelete}
        >
          ×
        </button>
      )}
    </div>
  );
}

/* =========================
   APP
========================= */

export default function App() {
  const [page, setPage] =
    useState("dashboard");

  const [theme, setTheme] =
    useState(
      localStorage.getItem(
        "compareai-theme"
      ) || "light"
    );

  const [url1, setUrl1] = useState("");
  const [url2, setUrl2] = useState("");
  const [requirement, setRequirement] =
    useState("");

  const [comparison, setComparison] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const [saved, setSaved] =
    useState([]);

  const [liked, setLiked] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    document.body.className =
      theme === "dark"
        ? "dark-mode"
        : "";

    localStorage.setItem(
      "compareai-theme",
      theme
    );
  }, [theme]);

  useEffect(() => {
    loadHistory();
    loadSaved();
    loadLiked();
  }, []);

  /* =========================
     LOAD
  ========================= */

  async function loadHistory() {
    try {
      const data =
        await apiRequest("/api/history");

      setHistory(
        Array.isArray(data)
          ? data
          : data.history || []
      );
    } catch (e) {
      console.log(e.message);
    }
  }

  async function loadSaved() {
    try {
      const data =
        await apiRequest("/api/saved");

      setSaved(
        Array.isArray(data)
          ? data
          : data.products || []
      );
    } catch (e) {
      console.log(e.message);
    }
  }

  async function loadLiked() {
    try {
      const data =
        await apiRequest("/api/liked");

      setLiked(
        Array.isArray(data)
          ? data
          : data.products || []
      );
    } catch (e) {
      console.log(e.message);
    }
  }

  /* =========================
     SAVE / LIKE
  ========================= */

  async function saveProduct(product) {
    try {
      await apiRequest("/api/saved", {
        method: "POST",
        body: JSON.stringify({
          product: normalizeProduct(product),
        }),
      });

      await loadSaved();
      alert("Product saved successfully.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function likeProduct(product) {
    try {
      await apiRequest("/api/liked", {
        method: "POST",
        body: JSON.stringify({
          product: normalizeProduct(product),
        }),
      });

      await loadLiked();
      alert("Product liked successfully.");
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteSaved(id) {
    try {
      await apiRequest(
        `/api/saved/${id}`,
        { method: "DELETE" }
      );

      await loadSaved();
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteLiked(id) {
    try {
      await apiRequest(
        `/api/liked/${id}`,
        { method: "DELETE" }
      );

      await loadLiked();
    } catch (e) {
      setError(e.message);
    }
  }

  async function clearHistory() {
    try {
      await apiRequest(
        "/api/history",
        { method: "DELETE" }
      );

      setHistory([]);
    } catch (e) {
      setError(e.message);
    }
  }

  /* =========================
     COMPARE
  ========================= */

  async function compareProducts() {
    setError("");

    if (!url1.trim() || !url2.trim()) {
      setError(
        "Please enter both product URLs."
      );
      return;
    }

    setLoading(true);

    try {
      const data =
        await apiRequest(
          "/api/compare",
          {
            method: "POST",
            body: JSON.stringify({
              products: [
                url1.trim(),
                url2.trim(),
              ],
              requirement:
                requirement.trim(),
            }),
          }
        );

      const result =
        data?.comparison ||
        data?.result ||
        data;

      setComparison(result);

      await loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     HISTORY NAMES
  ========================= */

  function historyNames(item) {
    let products =
      parseJSON(item?.products);

    if (typeof products === "string") {
      products = parseJSON(products);
    }

    if (!Array.isArray(products)) {
      return "Product Comparison";
    }

    return products
      .map((p) => normalizeProduct(p).name)
      .join(" vs ");
  }

  /* =========================
     RESULT DATA
  ========================= */

  const products = useMemo(
    () => getProducts(comparison),
    [comparison]
  );

  const best =
    comparison?.bestProduct || {};

  const cheapest =
    comparison?.cheapestProduct || {};

  const highestRated =
    comparison?.highestRatedProduct || {};

  /* =========================
     UI
  ========================= */

  return (
    <div className="app">

      {/* NAVBAR */}

      <header className="navbar">

        <div
          className="brand"
          onClick={() =>
            setPage("dashboard")
          }
        >
          <div className="brand-mark">
            AI
          </div>

          <div>
            <strong>
              ProductIQ
            </strong>

            <span>
              AI Product Comparison
            </span>
          </div>
        </div>

        <nav>

          <button
            className={
              `nav-link ${
                page === "dashboard"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("dashboard")
            }
          >
            Dashboard
          </button>

          <button
            className={
              `nav-link ${
                page === "compare"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("compare")
            }
          >
            Compare
          </button>

          <button
            className={
              `nav-link ${
                page === "saved"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("saved")
            }
          >
            Saved
          </button>

          <button
            className={
              `nav-link ${
                page === "liked"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("liked")
            }
          >
            Liked
          </button>

          <button
            className={
              `nav-link ${
                page === "history"
                  ? "active"
                  : ""
              }`
            }
            onClick={() =>
              setPage("history")
            }
          >
            History
          </button>

          <button
            className="theme-button"
            onClick={() =>
              setTheme(
                theme === "dark"
                  ? "light"
                  : "dark"
              )
            }
          >
            {theme === "dark"
              ? "☀"
              : "☾"}
          </button>

        </nav>
      </header>

      {/* ERROR */}

      {error && (
        <div className="page">
          <div className="error-box">
            <span>!</span>
            {error}
          </div>
        </div>
      )}

      {/* =========================
          DASHBOARD
      ========================= */}

      {page === "dashboard" && (
        <>
          <section className="hero">

            <div className="hero-content">

              <span className="hero-badge">
                ✦ AI POWERED
              </span>

              <h1>
                Find the
                <br />
                <span>Best Product.</span>
              </h1>

              <p>
                Compare products from Amazon
                and Flipkart using price,
                specifications, ratings and
                intelligent AI recommendations.
              </p>

              <div className="hero-actions">

                <button
                  className="primary-button"
                  onClick={() =>
                    setPage("compare")
                  }
                >
                  Start Comparing
                  <span>→</span>
                </button>

                <button
                  className="secondary-button"
                  onClick={() =>
                    setPage("history")
                  }
                >
                  View History
                </button>

              </div>
            </div>

            <div className="hero-visual">

              <div className="orb orb-one" />
              <div className="orb orb-two" />

              <div className="ai-card">

                <div className="ai-card-icon">
                  ✦
                </div>

                <div>
                  <span>
                    AI Recommendation
                  </span>

                  <strong>
                    Best Value Found
                  </strong>
                </div>

              </div>

              <div className="floating-card floating-one">
                <span>₹</span>
                Best Price
              </div>

              <div className="floating-card floating-two">
                <span>★</span>
                4.8 Rating
              </div>

            </div>
          </section>

          <section className="page">

            <div className="section-heading">
              <div>
                <span className="section-kicker">
                  FEATURES
                </span>

                <h2>
                  Everything you need
                </h2>
              </div>

              <p>
                Make smarter product
                decisions with AI-powered
                comparison.
              </p>
            </div>

            <div className="feature-grid">

              <div className="feature-card">
                <div className="feature-icon">
                  🔗
                </div>

                <h3>
                  Amazon & Flipkart
                </h3>

                <p>
                  Paste product URLs and
                  compare products from both
                  platforms.
                </p>

                <span className="feature-arrow">
                  →
                </span>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  📊
                </div>

                <h3>
                  Smart Comparison
                </h3>

                <p>
                  Compare price, ratings,
                  specifications and value.
                </p>

                <span className="feature-arrow">
                  →
                </span>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  🤖
                </div>

                <h3>
                  AI Recommendation
                </h3>

                <p>
                  Get an intelligent
                  recommendation based on
                  your requirements.
                </p>

                <span className="feature-arrow">
                  →
                </span>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  💾
                </div>

                <h3>
                  Save & Like
                </h3>

                <p>
                  Save products and keep your
                  favourite products organized.
                </p>

                <span className="feature-arrow">
                  →
                </span>
              </div>

            </div>

          </section>
        </>
      )}

      {/* =========================
          COMPARE
      ========================= */}

      {page === "compare" && (
        <main className="page">

          <div className="page-title">
            <span className="section-kicker">
              PRODUCT COMPARISON
            </span>

            <h1>
              Compare.
              <br />
              <span>
                Choose better.
              </span>
            </h1>

            <p>
              Paste two Amazon or Flipkart
              product URLs and let AI analyze
              which product gives you the
              best value.
            </p>
          </div>

          <div className="compare-input-card">

            <div className="input-header">

              <div>
                <div className="step-badge">
                  01
                </div>

                <div>
                  <h2>
                    Add Products
                  </h2>

                  <p>
                    Enter product URLs from
                    Amazon India or Flipkart.
                  </p>
                </div>
              </div>

            </div>

            <div className="url-grid">

              <div className="url-field">

                <label>
                  Product 01
                </label>

                <div className="url-input-wrap amazon-input">

                  <div className="store-icon">
                    A
                  </div>

                  <input
                    value={url1}
                    onChange={(e) =>
                      setUrl1(e.target.value)
                    }
                    placeholder="Paste Amazon / Flipkart URL"
                  />

                </div>
              </div>

              <div className="vs-box">
                VS
              </div>

              <div className="url-field">

                <label>
                  Product 02
                </label>

                <div className="url-input-wrap flipkart-input">

                  <div className="store-icon">
                    F
                  </div>

                  <input
                    value={url2}
                    onChange={(e) =>
                      setUrl2(e.target.value)
                    }
                    placeholder="Paste Amazon / Flipkart URL"
                  />

                </div>
              </div>

            </div>

            <div className="requirement-row">

              <label>
                <span>
                  Your Requirement
                </span>

                <small>
                  Optional — tell AI what
                  matters to you.
                </small>
              </label>

              <input
                value={requirement}
                onChange={(e) =>
                  setRequirement(
                    e.target.value
                  )
                }
                placeholder="Example: Best laptop for coding and AI/ML"
              />

            </div>

            <button
              className="compare-button"
              onClick={compareProducts}
              disabled={loading}
            >
              {loading
                ? "Analyzing Products..."
                : "Compare Products"}
              <span>→</span>
            </button>

          </div>

          {loading && (
            <div className="loading-result">

              <div className="loading-header">

                <div className="loading-orb">
                  ✦
                </div>

                <div>
                  <div className="skeleton title-skeleton" />
                  <div className="skeleton text-skeleton" />
                </div>

              </div>

              <div className="loading-grid">
                <div className="skeleton-card" />
                <div className="skeleton-card" />
              </div>

            </div>
          )}

          {!loading && comparison && (
            <section className="comparison-result">

              <div className="result-heading">

                <div>
                  <span className="section-kicker">
                    AI ANALYSIS COMPLETE
                  </span>

                  <h2>
                    Comparison Result
                  </h2>
                </div>

                <div className="ai-status">
                  <span className="status-dot" />
                  AI Powered
                </div>

              </div>

              {best.name && (
                <div className="winner-banner">

                  <div className="winner-icon">
                    🏆
                  </div>

                  <div className="winner-content">

                    <span>
                      AI RECOMMENDED
                    </span>

                    <h2>
                      {cleanText(
                        best.name
                      )}
                    </h2>

                    <p>
                      {cleanText(
                        comparison.recommendation,
                        "This product provides the best overall value."
                      )}
                    </p>

                  </div>

                  <div className="winner-score">

                    <strong>
                      {Math.round(
                        Number(
                          best.score
                        ) || 0
                      )}
                    </strong>

                    <span>
                      /100
                    </span>

                    <small>
                      Overall Score
                    </small>

                  </div>

                </div>
              )}

              <div className="quick-stats">

                <div className="quick-stat">
                  <div className="quick-stat-icon">
                    ₹
                  </div>

                  <div>
                    <span>
                      Cheapest
                    </span>

                    <strong>
                      {money(
                        cheapest.price
                      )}
                    </strong>

                    <small>
                      {cleanText(
                        cheapest.name,
                        "Not available"
                      )}
                    </small>
                  </div>
                </div>

                <div className="quick-stat">
                  <div className="quick-stat-icon">
                    ★
                  </div>

                  <div>
                    <span>
                      Highest Rated
                    </span>

                    <strong>
                      {rating(
                        highestRated.rating
                      )}
                    </strong>

                    <small>
                      {cleanText(
                        highestRated.name,
                        "Not available"
                      )}
                    </small>
                  </div>
                </div>

                <div className="quick-stat">
                  <div className="quick-stat-icon">
                    ↕
                  </div>

                  <div>
                    <span>
                      Price Difference
                    </span>

                    <strong>
                      {money(
                        comparison.priceDifference
                      )}
                    </strong>

                    <small>
                      Between products
                    </small>
                  </div>
                </div>

                <div className="quick-stat">
                  <div className="quick-stat-icon">
                    🤖
                  </div>

                  <div>
                    <span>
                      AI Engine
                    </span>

                    <strong>
                      Gemini
                    </strong>

                    <small>
                      AI Recommendation
                    </small>
                  </div>
                </div>

              </div>

              <div className="product-result-grid">

                {products.map(
                  (product, index) => (
                    <ProductCard
                      key={
                        `${product.name}-${index}`
                      }
                      product={product}
                      winner={
                        product.name ===
                        cleanText(
                          best.name,
                          ""
                        )
                      }
                      cheapest={
                        product.name ===
                        cleanText(
                          cheapest.name,
                          ""
                        )
                      }
                      highestRated={
                        product.name ===
                        cleanText(
                          highestRated.name,
                          ""
                        )
                      }
                      onSave={saveProduct}
                      onLike={likeProduct}
                    />
                  )
                )}

              </div>

              <div className="ai-insight-grid">

                <div className="ai-insight-card main-insight">

                  <div className="insight-heading">

                    <div className="insight-icon">
                      ✦
                    </div>

                    <div>
                      <span>
                        AI INSIGHT
                      </span>

                      <h3>
                        Recommendation
                      </h3>
                    </div>

                  </div>

                  <p>
                    {cleanText(
                      comparison?.recommendation ||
                        comparison?.ai?.recommendation ||
                        comparison?.ai?.summary,
                      "The comparison has been completed successfully."
                    )}
                  </p>

                  <div className="best-for">
                    <strong>
                      Best For
                    </strong>

                    <span>
                      {requirement ||
                        "Overall value"}
                    </span>
                  </div>

                </div>

                <div className="ai-insight-card">

                  <div className="insight-heading">

                    <div className="insight-icon">
                      ✓
                    </div>

                    <div>
                      <span>
                        SCORING
                      </span>

                      <h3>
                        Weightage
                      </h3>
                    </div>

                  </div>

                  <ul className="insight-list">

                    <li>
                      <span>✓</span>
                      Price — 25%
                    </li>

                    <li>
                      <span>✓</span>
                      Specifications — 40%
                    </li>

                    <li>
                      <span>✓</span>
                      Rating — 20%
                    </li>

                    <li>
                      <span>✓</span>
                      Data Confidence — 15%
                    </li>

                  </ul>

                </div>

                <div className="ai-insight-card">

                  <div className="insight-heading">

                    <div className="insight-icon">
                      🔗
                    </div>

                    <div>
                      <span>
                        DATA
                      </span>

                      <h3>
                        Product Sources
                      </h3>
                    </div>

                  </div>

                  <ul className="insight-list">

                    {products.map(
                      (p, i) => (
                        <li key={i}>
                          <span>✓</span>
                          {p.platform} product
                          data
                        </li>
                      )
                    )}

                  </ul>

                </div>

              </div>

              <div className="rag-banner">

                <div className="rag-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    Grounded Product Analysis
                  </strong>

                  <p>
                    Recommendations are based
                    on extracted Amazon/Flipkart
                    product information.
                  </p>
                </div>

                <div className="rag-badge">
                  VERIFIED
                </div>

              </div>

            </section>
          )}

        </main>
      )}

      {/* =========================
          SAVED
      ========================= */}

      {page === "saved" && (
        <main className="page">

          <div className="page-title">
            <span className="section-kicker">
              YOUR COLLECTION
            </span>

            <h1>
              Saved
              <br />
              <span>Products.</span>
            </h1>

            <p>
              Products you saved for later.
            </p>
          </div>

          {saved.length === 0 ? (
            <div className="empty-card large-empty">

              <div className="empty-icon">
                ♡
              </div>

              <h3>
                No saved products
              </h3>

              <p>
                Save a product from the
                comparison page and it will
                appear here.
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  setPage("compare")
                }
              >
                Compare Products →
              </button>

            </div>
          ) : (
            <div className="collection-grid">

              {saved.map(
                (item, index) => (
                  <CollectionCard
                    key={
                      item.id || index
                    }
                    item={item}
                    onDelete={() =>
                      deleteSaved(item.id)
                    }
                  />
                )
              )}

            </div>
          )}

        </main>
      )}

      {/* =========================
          LIKED
      ========================= */}

      {page === "liked" && (
        <main className="page">

          <div className="page-title">
            <span className="section-kicker">
              YOUR FAVOURITES
            </span>

            <h1>
              Liked
              <br />
              <span>Products.</span>
            </h1>

            <p>
              Products you liked while
              comparing.
            </p>
          </div>

          {liked.length === 0 ? (
            <div className="empty-card large-empty">

              <div className="empty-icon">
                ♥
              </div>

              <h3>
                No liked products
              </h3>

              <p>
                Like a product from the
                comparison page and it will
                appear here.
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  setPage("compare")
                }
              >
                Compare Products →
              </button>

            </div>
          ) : (
            <div className="collection-grid">

              {liked.map(
                (item, index) => (
                  <CollectionCard
                    key={
                      item.id || index
                    }
                    item={item}
                    onDelete={() =>
                      deleteLiked(item.id)
                    }
                  />
                )
              )}

            </div>
          )}

        </main>
      )}

      {/* =========================
          HISTORY
      ========================= */}

      {page === "history" && (
        <main className="page">

          <div className="history-title page-title">

            <div>
              <span className="section-kicker">
                YOUR ACTIVITY
              </span>

              <h1>
                Comparison
                <br />
                <span>History.</span>
              </h1>

              <p>
                Your previous product
                comparisons.
              </p>
            </div>

            {history.length > 0 && (
              <button
                className="danger-button"
                onClick={clearHistory}
              >
                Clear History
              </button>
            )}

          </div>

          {history.length === 0 ? (
            <div className="empty-card large-empty">

              <div className="empty-icon">
                ◷
              </div>

              <h3>
                No comparison history
              </h3>

              <p>
                Your product comparisons will
                appear here automatically.
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  setPage("compare")
                }
              >
                Start Comparing →
              </button>

            </div>
          ) : (
            <div className="history-list">

              {history.map(
                (item, index) => (
                  <div
                    className="history-item"
                    key={
                      item.id || index
                    }
                  >

                    <div className="history-index">
                      {String(
                        index + 1
                      ).padStart(2, "0")}
                    </div>

                    <div className="history-main">

                      <strong>
                        {historyNames(item)}
                      </strong>

                      <span>
                        {item.created_at ||
                          "Saved comparison"}
                      </span>

                    </div>

                    <div className="history-status">
                      ✓ Compared
                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </main>
      )}

      {/* FOOTER */}

      <footer className="footer">

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
