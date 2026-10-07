import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://ai-product-comparison-assistant.onrender.com";

const FALLBACK_IMAGE =
  "https://dummyimage.com/600x400/e5e7eb/6b7280&text=Product+Image";

/* =========================================================
   BASIC HELPERS
========================================================= */

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;

  let text = String(value).trim();

  // Remove markdown links: [Product](https://...)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, "$1");

  // Remove markdown bold / italic / heading
  text = text.replace(/(\*\*|\*|__|_|###|##|#)/g, "");

  // Decode escaped characters
  text = text.replace(/\\([&*_#[\]()])/g, "$1");

  return text.trim() || fallback;
}

function cleanImage(value) {
  if (!value) return "";

  let text = String(value).trim();

  // If image is markdown: [Product](URL)
  const markdownMatch = text.match(
    /\[[^\]]*\]\((https?:\/\/[^)]+)\)/i
  );

  if (markdownMatch) {
    return markdownMatch[1];
  }

  // If surrounded by markdown characters
  text = text.replace(/^["'`]+|["'`]+$/g, "");

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return "";
}

function money(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "Not available";
  }

  return `₹${number.toLocaleString("en-IN")}`;
}

function rating(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "N/A";
  }

  return number.toFixed(1);
}

function parsePossiblyStringified(value) {
  let result = value;

  for (let i = 0; i < 4; i++) {
    if (typeof result !== "string") break;

    const trimmed = result.trim();

    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);

      if (parsed === result) break;

      result = parsed;
    } catch {
      break;
    }
  }

  return result;
}

function normalizeProduct(product) {
  let value = parsePossiblyStringified(product);

  if (!value || typeof value !== "object") {
    return {
      name: cleanText(value, "Product"),
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

  const specifications =
    parsePossiblyStringified(value.specifications) || {};

  const scores =
    parsePossiblyStringified(value.scores) || {};

  return {
    ...value,

    name: cleanText(
      value.name ||
        value.title ||
        value.productName,
      "Product"
    ),

    brand: cleanText(
      value.brand,
      "Unknown"
    ),

    platform: cleanText(
      value.platform ||
        value.store ||
        value.source,
      "Store"
    ),

    price:
      Number(value.price) > 0
        ? Number(value.price)
        : 0,

    rating:
      Number(value.rating) > 0
        ? Number(value.rating)
        : 0,

    image: cleanImage(
      value.image ||
        value.imageUrl ||
        value.thumbnail
    ),

    availability: cleanText(
      value.availability,
      "Availability unknown"
    ),

    specifications,

    scores,
  };
}

function normalizeProducts(products) {
  if (!Array.isArray(products)) return [];

  return products.map(normalizeProduct);
}

function getProductList(data) {
  const products =
    data?.comparison?.products ||
    data?.result?.products ||
    data?.products ||
    [];

  return normalizeProducts(products);
}

function getComparisonObject(data) {
  return (
    data?.comparison ||
    data?.result ||
    data ||
    {}
  );
}

/* =========================================================
   IMAGE COMPONENT
========================================================= */

function ProductImage({
  src,
  alt,
  className = "",
}) {
  const [imageSrc, setImageSrc] =
    useState(cleanImage(src) || FALLBACK_IMAGE);

  useEffect(() => {
    setImageSrc(
      cleanImage(src) || FALLBACK_IMAGE
    );
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt || "Product"}
      className={className}
      onError={() => {
        if (imageSrc !== FALLBACK_IMAGE) {
          setImageSrc(FALLBACK_IMAGE);
        }
      }}
    />
  );
}

/* =========================================================
   API
========================================================= */

async function apiRequest(
  endpoint,
  options = {}
) {
  const response = await fetch(
    `${API_BASE}${endpoint}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    }
  );

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      "Server returned invalid response."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed (${response.status})`
    );
  }

  return data;
}

/* =========================================================
   COLLECTION CARD
========================================================= */

function CollectionCard({
  item,
  onDelete,
}) {
  let product =
    item?.product || item;

  product =
    normalizeProduct(product);

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
          {product.platform || "Product"}
        </span>

        <h3>
          {product.name || "Product"}
        </h3>

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

/* =========================================================
   PRODUCT RESULT CARD
========================================================= */

function ProductResultCard({
  product,
  isWinner,
  isCheapest,
  isHighestRated,
  onSave,
  onLike,
}) {
  const normalized =
    normalizeProduct(product);

  const scores =
    normalized.scores || {};

  const overall =
    Number(
      scores.overall ??
        scores.overallScore ??
        0
    ) || 0;

  return (
    <div
      className={
        isWinner
          ? "result-product-card winner-product"
          : "result-product-card"
      }
    >
      <div className="product-badges">
        {isWinner && (
          <span className="winner-badge">
            🏆 Best Choice
          </span>
        )}

        {isCheapest && (
          <span className="cheap-badge">
            💰 Cheapest
          </span>
        )}

        {isHighestRated && (
          <span className="rating-badge">
            ⭐ Highest Rated
          </span>
        )}
      </div>

      <div className="result-image">
        <ProductImage
          src={normalized.image}
          alt={normalized.name}
        />
      </div>

      <div className="result-product-info">
        <div className="store-row">
          <span>
            {normalized.platform ||
              "Store"}
          </span>

          <span>
            {normalized.brand ||
              "Brand"}
          </span>
        </div>

        <h3>
          {normalized.name}
        </h3>

        <div className="price-rating-row">
          <strong>
            {money(normalized.price)}
          </strong>

          <span className="rating-pill">
            ★ {rating(normalized.rating)}
          </span>
        </div>

        <div className="availability">
          <span className="availability-dot"></span>

          {normalized.availability ||
            "Availability unknown"}
        </div>

        <div className="score-mini">
          <div>
            <span>Overall</span>

            <strong>
              {Math.round(overall)}/100
            </strong>
          </div>

          <div className="score-bar">
            <span
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, overall)
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="card-actions">
          <button
            className="save-card-button"
            onClick={() =>
              onSave(normalized)
            }
          >
            ♡ Save
          </button>

          <button
            className="like-card-button"
            onClick={() =>
              onLike(normalized)
            }
          >
            ♥ Like
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   COMPARISON RESULT
========================================================= */

function ComparisonResult({
  comparison,
  onSave,
  onLike,
}) {
  const products = useMemo(
    () => getProductList(comparison),
    [comparison]
  );

  if (!products.length) {
    return (
      <div className="empty-state">
        <h3>No comparison result yet</h3>
        <p>
          Enter two product URLs and
          start comparison.
        </p>
      </div>
    );
  }

  const best =
    comparison?.bestProduct || {};

  const cheapest =
    comparison?.cheapestProduct || {};

  const highestRated =
    comparison?.highestRatedProduct ||
    {};

  return (
    <section className="comparison-results">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            AI ANALYSIS
          </span>

          <h2>
            Product Comparison
          </h2>

          <p>
            Compare price, specifications,
            ratings and overall value.
          </p>
        </div>
      </div>

      <div className="result-products-grid">
        {products.map(
          (product, index) => (
            <ProductResultCard
              key={
                `${product.name}-${index}`
              }
              product={product}
              isWinner={
                product.name ===
                cleanText(
                  best.name,
                  ""
                )
              }
              isCheapest={
                product.name ===
                cleanText(
                  cheapest.name,
                  ""
                )
              }
              isHighestRated={
                product.name ===
                cleanText(
                  highestRated.name,
                  ""
                )
              }
              onSave={onSave}
              onLike={onLike}
            />
          )
        )}
      </div>

      <div className="recommendation-card">
        <span className="section-kicker">
          AI RECOMMENDATION
        </span>

        <h3>
          {cleanText(
            comparison?.recommendation ||
              comparison?.ai?.recommendation ||
              comparison?.ai?.summary,
            "Comparison completed successfully."
          )}
        </h3>
      </div>

      <div className="comparison-summary-grid">
        <div className="summary-card">
          <span>Best Product</span>
          <strong>
            {cleanText(
              best.name,
              "Not available"
            )}
          </strong>
        </div>

        <div className="summary-card">
          <span>Cheapest</span>
          <strong>
            {cleanText(
              cheapest.name,
              "Not available"
            )}
          </strong>
        </div>

        <div className="summary-card">
          <span>Highest Rated</span>
          <strong>
            {cleanText(
              highestRated.name,
              "Not available"
            )}
          </strong>
        </div>

        <div className="summary-card">
          <span>Price Difference</span>
          <strong>
            {money(
              comparison?.priceDifference
            )}
          </strong>
        </div>
      </div>

      <div className="score-breakdown">
        <h3>
          Scoring Breakdown
        </h3>

        <p>
          Price 25% • Specifications 40%
          • Rating 20% • Data confidence
          15%
        </p>
      </div>
    </section>
  );
}

/* =========================================================
   MAIN APP
========================================================= */

export default function App() {
  const [page, setPage] =
    useState("dashboard");

  const [theme, setTheme] =
    useState(
      localStorage.getItem(
        "compareai-theme"
      ) || "light"
    );

  const [firstUrl, setFirstUrl] =
    useState("");

  const [secondUrl, setSecondUrl] =
    useState("");

  const [requirement, setRequirement] =
    useState("");

  const [comparison, setComparison] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const [savedProducts, setSavedProducts] =
    useState([]);

  const [likedProducts, setLikedProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  /* =======================================================
     THEME
  ======================================================= */

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

  /* =======================================================
     LOAD DATA
  ======================================================= */

  useEffect(() => {
    loadHistory();
    loadSavedProducts();
    loadLikedProducts();
  }, []);

  /* =======================================================
     HISTORY
  ======================================================= */

  async function loadHistory() {
    try {
      const data =
        await apiRequest("/api/history");

      const items =
        Array.isArray(data)
          ? data
          : data.history || [];

      setHistory(items);
    } catch (err) {
      console.log(
        "History error:",
        err.message
      );
    }
  }

  async function clearHistory() {
    try {
      await apiRequest(
        "/api/history",
        {
          method: "DELETE",
        }
      );

      setHistory([]);

      setMessage(
        "History cleared successfully."
      );
    } catch (err) {
      setError(err.message);
    }
  }

  /* =======================================================
     SAVED
  ======================================================= */

  async function loadSavedProducts() {
    try {
      const data =
        await apiRequest("/api/saved");

      const items =
        Array.isArray(data)
          ? data
          : data.products || [];

      setSavedProducts(items);
    } catch (err) {
      console.log(
        "Saved products error:",
        err.message
      );
    }
  }

  async function saveProduct(product) {
    try {
      await apiRequest(
        "/api/saved",
        {
          method: "POST",
          body: JSON.stringify({
            product:
              normalizeProduct(product),
          }),
        }
      );

      await loadSavedProducts();

      setMessage(
        "Product saved successfully."
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteSavedProduct(id) {
    try {
      await apiRequest(
        `/api/saved/${id}`,
        {
          method: "DELETE",
        }
      );

      await loadSavedProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  /* =======================================================
     LIKED
  ======================================================= */

  async function loadLikedProducts() {
    try {
      const data =
        await apiRequest("/api/liked");

      const items =
        Array.isArray(data)
          ? data
          : data.products || [];

      setLikedProducts(items);
    } catch (err) {
      console.log(
        "Liked products error:",
        err.message
      );
    }
  }

  async function likeProduct(product) {
    try {
      await apiRequest(
        "/api/liked",
        {
          method: "POST",
          body: JSON.stringify({
            product:
              normalizeProduct(product),
          }),
        }
      );

      await loadLikedProducts();

      setMessage(
        "Product liked successfully."
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteLikedProduct(id) {
    try {
      await apiRequest(
        `/api/liked/${id}`,
        {
          method: "DELETE",
        }
      );

      await loadLikedProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  /* =======================================================
     COMPARE
  ======================================================= */

  async function handleCompare() {
    setError("");
    setMessage("");

    if (!firstUrl.trim()) {
      setError(
        "Please enter the first product URL."
      );
      return;
    }

    if (!secondUrl.trim()) {
      setError(
        "Please enter the second product URL."
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
                firstUrl.trim(),
                secondUrl.trim(),
              ],

              requirement:
                requirement.trim(),
            }),
          }
        );

      const result =
        getComparisonObject(data);

      setComparison(result);

      await loadHistory();

      setMessage(
        "Products compared successfully."
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Comparison failed."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  function goToCompare() {
    setPage("compare");
  }

  function resetMessages() {
    setError("");
    setMessage("");
  }

  /* =======================================================
     HISTORY PRODUCT NAMES
  ======================================================= */

  function getHistoryNames(item) {
    let products =
      parsePossiblyStringified(
        item?.products
      );

    if (
      typeof products === "string"
    ) {
      products =
        parsePossiblyStringified(
          products
        );
    }

    if (!Array.isArray(products)) {
      return "Product Comparison";
    }

    const names = products
      .map((product) =>
        normalizeProduct(product).name
      )
      .filter(Boolean);

    return names.length
      ? names.join(" vs ")
      : "Product Comparison";
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className={`app ${
        theme === "dark"
          ? "dark-theme"
          : ""
      }`}
    >
      {/* HEADER */}

      <header className="top-header">
        <div className="brand">
          <div className="brand-logo">
            AI
          </div>

          <div>
            <h1>
              AI Product
              <span>
                Comparison
              </span>
            </h1>

            <small>
              Smart • Simple • AI Powered
            </small>
          </div>
        </div>

        <nav className="main-nav">
          <button
            className={
              page === "dashboard"
                ? "active"
                : ""
            }
            onClick={() => {
              resetMessages();
              setPage("dashboard");
            }}
          >
            Dashboard
          </button>

          <button
            className={
              page === "compare"
                ? "active"
                : ""
            }
            onClick={() => {
              resetMessages();
              setPage("compare");
            }}
          >
            Compare
          </button>

          <button
            className={
              page === "history"
                ? "active"
                : ""
            }
            onClick={() => {
              resetMessages();
              setPage("history");
            }}
          >
            History
          </button>

          <button
            className={
              page === "saved"
                ? "active"
                : ""
            }
            onClick={() => {
              resetMessages();
              setPage("saved");
            }}
          >
            Saved
          </button>

          <button
            className={
              page === "liked"
                ? "active"
                : ""
            }
            onClick={() => {
              resetMessages();
              setPage("liked");
            }}
          >
            Liked
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
              ? "☀️"
              : "🌙"}
          </button>
        </nav>
      </header>

      {/* MESSAGES */}

      {(message || error) && (
        <div className="message-container">
          {message && (
            <div className="success-message">
              ✓ {message}
            </div>
          )}

          {error && (
            <div className="error-message">
              ✕ {error}
            </div>
          )}
        </div>
      )}

      {/* DASHBOARD */}

      {page === "dashboard" && (
        <main className="dashboard-page">
          <section className="hero-section">
            <div className="hero-content">
              <span className="hero-kicker">
                AI PRODUCT COMPARISON
              </span>

              <h2>
                Find the
                <br />
                <span>Best Product</span>
              </h2>

              <p>
                Compare products from
                Amazon and Flipkart using
                price, specifications,
                ratings and AI-powered
                recommendations.
              </p>

              <button
                className="primary-button"
                onClick={goToCompare}
              >
                Start Comparing →
              </button>
            </div>

            <div className="hero-visual">
              <div className="floating-card card-one">
                <span>PRICE</span>
                <strong>
                  ₹ Best Value
                </strong>
              </div>

              <div className="floating-card card-two">
                <span>RATING</span>
                <strong>
                  ★ 4.8
                </strong>
              </div>

              <div className="ai-circle">
                <span>AI</span>
              </div>
            </div>
          </section>

          <section className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                🔗
              </div>

              <h3>
                Amazon & Flipkart
              </h3>

              <p>
                Compare products using
                their product URLs.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                📊
              </div>

              <h3>
                Smart Comparison
              </h3>

              <p>
                Compare price, rating and
                specifications.
              </p>
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
                product recommendation.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                💾
              </div>

              <h3>
                Save & Like
              </h3>

              <p>
                Keep your favourite
                products organized.
              </p>
            </div>
          </section>
        </main>
      )}

      {/* COMPARE */}

      {page === "compare" && (
        <main className="compare-page">
          <section className="page-heading">
            <span className="section-kicker">
              COMPARE PRODUCTS
            </span>

            <h2>
              Which product is
              <span> better?</span>
            </h2>

            <p>
              Paste product URLs from
              Amazon India or Flipkart.
            </p>
          </section>

          <section className="compare-form-card">
            <div className="url-input-grid">
              <div className="input-group">
                <label>
                  Product 1 URL
                </label>

                <input
                  type="url"
                  placeholder="Paste Amazon / Flipkart URL"
                  value={firstUrl}
                  onChange={(e) =>
                    setFirstUrl(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="vs-divider">
                VS
              </div>

              <div className="input-group">
                <label>
                  Product 2 URL
                </label>

                <input
                  type="url"
                  placeholder="Paste Amazon / Flipkart URL"
                  value={secondUrl}
                  onChange={(e) =>
                    setSecondUrl(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="input-group">
              <label>
                What are you looking for?
              </label>

              <input
                type="text"
                placeholder="Example: Best laptop for coding and AI/ML"
                value={requirement}
                onChange={(e) =>
                  setRequirement(
                    e.target.value
                  )
                }
              />
            </div>

            <button
              className="compare-button"
              onClick={handleCompare}
              disabled={loading}
            >
              {loading
                ? "Comparing..."
                : "Compare Products →"}
            </button>
          </section>

          {comparison && (
            <ComparisonResult
              comparison={comparison}
              onSave={saveProduct}
              onLike={likeProduct}
            />
          )}
        </main>
      )}

      {/* HISTORY */}

      {page === "history" && (
        <main className="collection-page">
          <section className="page-heading">
            <span className="section-kicker">
              YOUR ACTIVITY
            </span>

            <h2>
              Comparison
              <span> History</span>
            </h2>

            <p>
              Your previous product
              comparisons.
            </p>

            {history.length > 0 && (
              <button
                className="secondary-button"
                onClick={clearHistory}
              >
                Clear History
              </button>
            )}
          </section>

          <div className="history-list">
            {history.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  🕘
                </div>

                <h3>
                  No history yet
                </h3>

                <p>
                  Your comparisons will
                  appear here.
                </p>
              </div>
            ) : (
              history.map(
                (item, index) => (
                  <div
                    className="history-card"
                    key={
                      item.id || index
                    }
                  >
                    <div className="history-icon">
                      📊
                    </div>

                    <div>
                      <strong>
                        {getHistoryNames(
                          item
                        )}
                      </strong>

                      <span>
                        {item.created_at ||
                          "Saved comparison"}
                      </span>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </main>
      )}

      {/* SAVED */}

      {page === "saved" && (
        <main className="collection-page">
          <section className="page-heading">
            <span className="section-kicker">
              YOUR COLLECTION
            </span>

            <h2>
              Saved
              <span> Products</span>
            </h2>

            <p>
              Products you saved for
              later.
            </p>
          </section>

          <div className="collection-grid">
            {savedProducts.length ===
            0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ♡
                </div>

                <h3>
                  No saved products
                </h3>

                <p>
                  Save products from a
                  comparison to see them
                  here.
                </p>
              </div>
            ) : (
              savedProducts.map(
                (item, index) => (
                  <CollectionCard
                    key={
                      item.id || index
                    }
                    item={item}
                    onDelete={() =>
                      deleteSavedProduct(
                        item.id
                      )
                    }
                  />
                )
              )
            )}
          </div>
        </main>
      )}

      {/* LIKED */}

      {page === "liked" && (
        <main className="collection-page">
          <section className="page-heading">
            <span className="section-kicker">
              YOUR FAVOURITES
            </span>

            <h2>
              Liked
              <span> Products</span>
            </h2>

            <p>
              Products you liked while
              comparing.
            </p>
          </section>

          <div className="collection-grid">
            {likedProducts.length ===
            0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ♥
                </div>

                <h3>
                  No liked products
                </h3>

                <p>
                  Like products from a
                  comparison to see them
                  here.
                </p>
              </div>
            ) : (
              likedProducts.map(
                (item, index) => (
                  <CollectionCard
                    key={
                      item.id || index
                    }
                    item={item}
                    onDelete={() =>
                      deleteLikedProduct(
                        item.id
                      )
                    }
                  />
                )
              )
            )}
          </div>
        </main>
      )}

      {/* FOOTER */}

      <footer className="app-footer">
        <div>
          <strong>
            AI Product Comparison
            Assistant
          </strong>

          <span>
            Smart comparison powered by
            AI.
          </span>
        </div>

        <span>
          B.Sc. Artificial Intelligence
        </span>
      </footer>
    </div>
  );
}
