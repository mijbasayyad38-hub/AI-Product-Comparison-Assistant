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
  };
};

async function request(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Server returned invalid data.");
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        `Request failed: ${response.status}`
    );
  }

  return data;
}

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

        <div className="availability">
          <span />
          {p.availability}
        </div>

        <div className="product-actions">
          <button
            onClick={() => onSave(p)}
            className="save-btn"
          >
            ♡ Save
          </button>

          <button
            onClick={() => onLike(p)}
            className="like-btn"
          >
            ♥ Like
          </button>
        </div>
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
  const [requirement, setRequirement] =
    useState("");

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

  async function loadHistory() {
    try {
      const data =
        await request("/api/history");

      setHistory(
        Array.isArray(data)
          ? data
          : data.history || []
      );
    } catch (error) {
      console.log(error.message);
    }
  }

  async function loadSaved() {
    try {
      const data =
        await request("/api/saved");

      setSaved(
        Array.isArray(data)
          ? data
          : data.products || []
      );
    } catch (error) {
      console.log(error.message);
    }
  }

  async function loadLiked() {
    try {
      const data =
        await request("/api/liked");

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
            requirement:
              requirement.trim(),
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

      await loadSaved();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteLiked(id) {
    try {
      await request(`/api/liked/${id}`, {
        method: "DELETE",
      });

      await loadLiked();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function clearHistory() {
    try {
      await request("/api/history", {
        method: "DELETE",
      });

      setHistory([]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function historyTitle(item) {
    let products =
      parseData(item?.products);

    if (typeof products === "string") {
      products = parseData(products);
    }

    if (!Array.isArray(products)) {
      return "Product Comparison";
    }

    return products
      .map((product) =>
        normalizeProduct(product).name
      )
      .join("  VS  ");
  }

  const products =
    result?.products ||
    result?.comparison?.products ||
    [];

  const best =
    result?.bestProduct ||
    result?.comparison?.bestProduct ||
    {};

  const recommendation =
    result?.recommendation ||
    result?.ai?.recommendation ||
    result?.ai?.summary ||
    "Comparison completed successfully.";

  return (
    <div className="app-shell">

      {/* NAVBAR */}

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

        <button
          className="theme-toggle"
          onClick={() => setDark(!dark)}
        >
          {dark ? "☀" : "☾"}
        </button>
      </header>

      {/* MESSAGE */}

      {message && (
        <div className="message-bar">
          <span>{message}</span>
          <button
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}

      {/* DASHBOARD */}

      {page === "dashboard" && (
        <main>

          <section className="hero-section">
            <div className="hero-left">

              <div className="hero-tag">
                ✦ AI POWERED
              </div>

              <h1>
                Compare smarter.
                <br />
                <span>Choose better.</span>
              </h1>

              <p>
                Compare products from Amazon
                and Flipkart using price,
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

              <div className="floating-card price-float">
                <b>₹</b>
                <span>
                  Best Price
                  <strong>Found</strong>
                </span>
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

              <div className="vs">
                VS
              </div>

              <div className="url-box">
                <label>
                  PRODUCT 02
                </label>

                <div className="url-input">
                  <span className="flipkart">
                    F
                  </span>

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

            <div className="requirement-box-new">
              <label>
                YOUR REQUIREMENT
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
              className="compare-main-btn"
              onClick={compare}
              disabled={loading}
            >
              {loading
                ? "Analyzing..."
                : "Compare Products"}
              <span>→</span>
            </button>
          </section>

          {loading && (
            <div className="loading-box">
              <div className="loader">
                ✦
              </div>
              <h2>
                Analyzing products...
              </h2>
              <p>
                Extracting product details
                and calculating the best value.
              </p>
            </div>
          )}

          {!loading && result && (
            <section className="results-section">

              <div className="results-heading">
                <div>
                  <span>
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

                <div>
                  <span>
                    PRICE DIFFERENCE
                  </span>
                  <strong>
                    {money(
                      result?.priceDifference
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    PRODUCTS
                  </span>
                  <strong>
                    {products.length}
                  </strong>
                </div>

              </div>

              <div className="products-heading">
                <div>
                  <span>
                    SIDE BY SIDE
                  </span>
                  <h2>
                    Product Details
                  </h2>
                </div>
              </div>

              <div className="product-grid-new">
                {products.map(
                  (product, index) => (
                    <ProductCard
                      key={index}
                      product={product}
                      best={
                        clean(
                          product.name
                        ) ===
                        clean(best.name)
                      }
                      onSave={saveProduct}
                      onLike={likeProduct}
                    />
                  )
                )}
              </div>

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

              <div className="scoring-box">
                <div>
                  <span>PRICE</span>
                  <strong>25%</strong>
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

      {/* LIKED */}

      {page === "liked" && (
        <main className="content-page">

          <div className="page-heading">
            <span>LIKED PRODUCTS</span>
            <h1>
              Your favourite
              <br />
              <strong>products.</strong>
            </h1>
            <p>
              Products you liked while
              comparing.
            </p>
          </div>

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