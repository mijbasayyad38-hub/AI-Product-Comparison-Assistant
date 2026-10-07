import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

/* =========================================================
   CONFIG
   ========================================================= */

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

/* =========================================================
   IMAGE FALLBACK
   ========================================================= */

const FALLBACK_IMAGE =
  "https://dummyimage.com/600x400/e5e7eb/6b7280&text=Product+Image";

function ProductImage({
  src,
  alt,
  className = "",
}) {
  const [imageSrc, setImageSrc] =
    useState(src || FALLBACK_IMAGE);

  useEffect(() => {
    setImageSrc(src || FALLBACK_IMAGE);
  }, [src]);

  return (
    <img
      src={imageSrc}
      alt={alt || "Product"}
      className={className}
      onError={() =>
        setImageSrc(FALLBACK_IMAGE)
      }
    />
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

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

function getProductList(data) {
  return (
    data?.comparison?.products ||
    data?.result?.products ||
    data?.products ||
    []
  );
}

/* =========================================================
   APP
   ========================================================= */

export default function App() {
  const [activePage, setActivePage] =
    useState("dashboard");

  const [firstUrl, setFirstUrl] =
    useState("");

  const [secondUrl, setSecondUrl] =
    useState("");

  const [requirement, setRequirement] =
    useState("");

  const [comparison, setComparison] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [history, setHistory] =
    useState([]);

  const [savedProducts, setSavedProducts] =
    useState([]);

  const [likedProducts, setLikedProducts] =
    useState([]);

  const [darkMode, setDarkMode] =
    useState(false);

  const [showRequirement, setShowRequirement] =
    useState(false);

  /* =======================================================
     LOAD DATA
     ======================================================= */

  useEffect(() => {
    loadHistory();
    loadSavedProducts();
    loadLikedProducts();
  }, []);

  /* =======================================================
     API
     ======================================================= */

  async function apiRequest(
    endpoint,
    options = {}
  ) {
    const response = await fetch(
      `${API_BASE}${endpoint}`,
      {
        headers: {
          "Content-Type":
            "application/json",
          ...(options.headers || {}),
        },
        ...options,
      }
    );

    const data =
      await response.json().catch(
        () => ({})
      );

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Something went wrong."
      );
    }

    return data;
  }

  async function loadHistory() {
    try {
      const data =
        await apiRequest(
          "/api/history"
        );

      setHistory(
        data.history || []
      );
    } catch (err) {
      console.log(
        "History:",
        err.message
      );
    }
  }

  async function loadSavedProducts() {
    try {
      const data =
        await apiRequest(
          "/api/saved"
        );

      setSavedProducts(
        data.products || []
      );
    } catch (err) {
      console.log(
        "Saved:",
        err.message
      );
    }
  }

  async function loadLikedProducts() {
    try {
      const data =
        await apiRequest(
          "/api/liked"
        );

      setLikedProducts(
        data.products || []
      );
    } catch (err) {
      console.log(
        "Liked:",
        err.message
      );
    }
  }

  /* =======================================================
     URL VALIDATION
     ======================================================= */

  function validateStoreUrl(value) {
    try {
      const url =
        new URL(
          value.trim()
        );

      const host =
        url.hostname
          .toLowerCase()
          .replace(
            /^www\./,
            ""
          );

      return (
        host === "amazon.in" ||
        host.endsWith(
          ".amazon.in"
        ) ||
        host === "amzn.in" ||
        host.endsWith(
          ".amzn.in"
        ) ||
        host ===
          "flipkart.com" ||
        host.endsWith(
          ".flipkart.com"
        ) ||
        host ===
          "dl.flipkart.com"
      );
    } catch {
      return false;
    }
  }

  /* =======================================================
     COMPARE
     ======================================================= */

  async function handleCompare() {
    setError("");

    const first =
      firstUrl.trim();

    const second =
      secondUrl.trim();

    if (!first || !second) {
      setError(
        "Please enter both product URLs."
      );
      return;
    }

    if (
      !validateStoreUrl(first)
    ) {
      setError(
        "First URL must be a valid Amazon India or Flipkart product URL."
      );
      return;
    }

    if (
      !validateStoreUrl(second)
    ) {
      setError(
        "Second URL must be a valid Amazon India or Flipkart product URL."
      );
      return;
    }

    if (
      first === second
    ) {
      setError(
        "Please enter two different product URLs."
      );
      return;
    }

    setLoading(true);
    setActivePage("compare");

    try {
      const data =
        await apiRequest(
          "/api/compare",
          {
            method: "POST",

            body: JSON.stringify({
              products: [
                first,
                second,
              ],

              requirement:
                requirement.trim(),
            }),
          }
        );

      setComparison(
        data.comparison ||
          data.result ||
          data
      );

      await loadHistory();
    } catch (err) {
      setError(
        err.message ||
          "Comparison failed."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     SAVE PRODUCT
     ======================================================= */

  async function saveProduct(
    product
  ) {
    try {
      await apiRequest(
        "/api/saved",
        {
          method: "POST",
          body: JSON.stringify({
            product,
          }),
        }
      );

      await loadSavedProducts();
    } catch (err) {
      setError(
        err.message
      );
    }
  }

  /* =======================================================
     LIKE PRODUCT
     ======================================================= */

  async function likeProduct(
    product
  ) {
    try {
      await apiRequest(
        "/api/liked",
        {
          method: "POST",
          body: JSON.stringify({
            product,
          }),
        }
      );

      await loadLikedProducts();
    } catch (err) {
      setError(
        err.message
      );
    }
  }

  /* =======================================================
     DELETE SAVED
     ======================================================= */

  async function deleteSaved(
    id
  ) {
    try {
      await apiRequest(
        `/api/saved/${id}`,
        {
          method: "DELETE",
        }
      );

      await loadSavedProducts();
    } catch (err) {
      setError(
        err.message
      );
    }
  }

  /* =======================================================
     DELETE LIKED
     ======================================================= */

  async function deleteLiked(
    id
  ) {
    try {
      await apiRequest(
        `/api/liked/${id}`,
        {
          method: "DELETE",
        }
      );

      await loadLikedProducts();
    } catch (err) {
      setError(
        err.message
      );
    }
  }

  /* =======================================================
     CLEAR HISTORY
     ======================================================= */

  async function clearHistory() {
    try {
      await apiRequest(
        "/api/history",
        {
          method: "DELETE",
        }
      );

      setHistory([]);
    } catch (err) {
      setError(
        err.message
      );
    }
  }

  /* =======================================================
     CURRENT PRODUCTS
     ======================================================= */

  const products = useMemo(
    () =>
      getProductList(
        comparison
      ),
    [comparison]
  );

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function navigate(page) {
    setActivePage(page);
    setError("");
  }

  /* =======================================================
     DASHBOARD
     ======================================================= */

  function Dashboard() {
    return (
      <div className="page dashboard-page">
        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              <span>✦</span>
              AI Powered Product Intelligence
            </div>

            <h1>
              Compare Smarter.
              <br />
              <span>
                Choose Better.
              </span>
            </h1>

            <p>
              Compare products from Amazon
              and Flipkart using real product
              information, transparent scoring,
              RAG and Gemini AI.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() =>
                  navigate("compare")
                }
              >
                Start Comparing
                <span>→</span>
              </button>

              <button
                className="secondary-button"
                onClick={() =>
                  setShowRequirement(
                    !showRequirement
                  )
                }
              >
                ✨ AI Requirements
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="orb orb-one"></div>
            <div className="orb orb-two"></div>

            <div className="ai-card">
              <div className="ai-card-icon">
                ✦
              </div>

              <div>
                <span>
                  AI Analysis
                </span>

                <strong>
                  Intelligent
                  Comparison
                </strong>
              </div>
            </div>

            <div className="floating-card floating-one">
              <span>₹</span>
              Best Price
            </div>

            <div className="floating-card floating-two">
              <span>★</span>
              Best Rating
            </div>
          </div>
        </section>

        {showRequirement && (
          <section className="requirement-box">
            <div>
              <span className="section-kicker">
                AI REQUIREMENT ANALYSIS
              </span>

              <h2>
                Tell AI what you need
              </h2>

              <p>
                Example: "I need a laptop
                under ₹60,000 for coding
                and multitasking."
              </p>
            </div>

            <div className="requirement-input-row">
              <input
                value={requirement}
                onChange={(e) =>
                  setRequirement(
                    e.target.value
                  )
                }
                placeholder="Describe your requirement..."
              />

              <button
                className="primary-button"
                onClick={() =>
                  navigate("compare")
                }
              >
                Use Requirement
              </button>
            </div>
          </section>
        )}

        <section className="feature-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                POWERFUL FEATURES
              </span>

              <h2>
                Everything you need
              </h2>
            </div>

            <p>
              Built to make product
              research faster and easier.
            </p>
          </div>

          <div className="feature-grid">
            <FeatureCard
              icon="⚡"
              title="Smart Comparison"
              text="Compare price, rating, specifications and overall value."
            />

            <FeatureCard
              icon="✦"
              title="Gemini AI"
              text="Get an intelligent recommendation based on extracted facts."
            />

            <FeatureCard
              icon="◈"
              title="RAG Grounding"
              text="AI answers are grounded in the product information collected."
            />

            <FeatureCard
              icon="◉"
              title="Transparent Score"
              text="See exactly how price, specifications and rating affect the winner."
            />
          </div>
        </section>

        <section className="popular-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                YOUR ACTIVITY
              </span>

              <h2>
                Recently compared
              </h2>
            </div>

            <button
              className="text-button"
              onClick={() =>
                navigate("history")
              }
            >
              View History →
            </button>
          </div>

          {history.length === 0 ? (
            <div className="empty-card">
              <div className="empty-icon">
                ◫
              </div>

              <h3>
                No comparisons yet
              </h3>

              <p>
                Start your first comparison
                and it will appear here.
              </p>

              <button
                className="primary-button"
                onClick={() =>
                  navigate("compare")
                }
              >
                Compare Products
              </button>
            </div>
          ) : (
            <div className="history-preview">
              {history
                .slice(0, 3)
                .map(
                  (item, index) => (
                    <div
                      className="history-preview-card"
                      key={
                        item.id ||
                        index
                      }
                    >
                      <div className="history-number">
                        0
                        {index + 1}
                      </div>

                      <div>
                        <strong>
                          Product
                          Comparison
                        </strong>

                        <span>
                          {item.created_at ||
                            "Recent comparison"}
                        </span>
                      </div>
                    </div>
                  )
                )}
            </div>
          )}
        </section>
      </div>
    );
  }

  /* =======================================================
     COMPARE PAGE
     ======================================================= */

  function ComparePage() {
    return (
      <div className="page compare-page">
        <div className="page-title">
          <span className="section-kicker">
            PRODUCT LAB
          </span>

          <h1>
            Compare Products
          </h1>

          <p>
            Paste two Amazon or Flipkart
            product links and let AI do the
            analysis.
          </p>
        </div>

        <section className="compare-input-card">
          <div className="input-header">
            <div>
              <span className="step-badge">
                01
              </span>

              <div>
                <h2>
                  Add Products
                </h2>

                <p>
                  Enter product URLs from
                  supported stores.
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
                <span className="store-icon">
                  A
                </span>

                <input
                  value={firstUrl}
                  onChange={(e) =>
                    setFirstUrl(
                      e.target.value
                    )
                  }
                  placeholder="Paste Amazon.in product URL"
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
                <span className="store-icon">
                  F
                </span>

                <input
                  value={secondUrl}
                  onChange={(e) =>
                    setSecondUrl(
                      e.target.value
                    )
                  }
                  placeholder="Paste Flipkart.com product URL"
                />
              </div>
            </div>
          </div>

          <div className="requirement-row">
            <label>
              <span>
                Optional AI Requirement
              </span>

              <small>
                Help AI understand what
                matters to you
              </small>
            </label>

            <input
              value={requirement}
              onChange={(e) =>
                setRequirement(
                  e.target.value
                )
              }
              placeholder="e.g. Best laptop for coding under ₹60,000"
            />
          </div>

          {error && (
            <div className="error-box">
              <span>!</span>
              {error}
            </div>
          )}

          <button
            className="compare-button"
            onClick={
              handleCompare
            }
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Analyzing Products...
              </>
            ) : (
              <>
                ✦ Compare with AI
                <span>→</span>
              </>
            )}
          </button>
        </section>

        {loading && (
          <LoadingComparison />
        )}

        {!loading &&
          comparison && (
            <ComparisonResult
              comparison={
                comparison
              }
              products={
                products
              }
              onSave={
                saveProduct
              }
              onLike={
                likeProduct
              }
            />
          )}
      </div>
    );
  }

  /* =======================================================
     SAVED PAGE
     ======================================================= */

  function SavedPage() {
    return (
      <div className="page">
        <PageHeader
          kicker="YOUR COLLECTION"
          title="Saved Products"
          text="Products you saved for later."
        />

        {savedProducts.length ===
        0 ? (
          <EmptyState
            icon="♡"
            title="No saved products"
            text="Save products from comparison results to see them here."
            action="Compare Products"
            onClick={() =>
              navigate("compare")
            }
          />
        ) : (
          <div className="collection-grid">
            {savedProducts.map(
              (item, index) => (
                <CollectionCard
                  key={
                    item.id ||
                    index
                  }
                  item={item}
                  onDelete={() =>
                    deleteSaved(
                      item.id
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </div>
    );
  }

  /* =======================================================
     LIKED PAGE
     ======================================================= */

  function LikedPage() {
    return (
      <div className="page">
        <PageHeader
          kicker="YOUR FAVOURITES"
          title="Liked Products"
          text="Products you marked as favourites."
        />

        {likedProducts.length ===
        0 ? (
          <EmptyState
            icon="♥"
            title="No liked products"
            text="Like products from comparison results to see them here."
            action="Compare Products"
            onClick={() =>
              navigate("compare")
            }
          />
        ) : (
          <div className="collection-grid">
            {likedProducts.map(
              (item, index) => (
                <CollectionCard
                  key={
                    item.id ||
                    index
                  }
                  item={item}
                  onDelete={() =>
                    deleteLiked(
                      item.id
                    )
                  }
                />
              )
            )}
          </div>
        )}
      </div>
    );
  }

  /* =======================================================
     HISTORY PAGE
     ======================================================= */

  function HistoryPage() {
    return (
      <div className="page">
        <div className="page-title history-title">
          <div>
            <span className="section-kicker">
              ACTIVITY
            </span>

            <h1>
              Comparison History
            </h1>

            <p>
              Your previous product
              comparisons.
            </p>
          </div>

          {history.length > 0 && (
            <button
              className="danger-button"
              onClick={
                clearHistory
              }
            >
              Clear History
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon="◷"
            title="History is empty"
            text="Your completed comparisons will appear here."
            action="Start Comparing"
            onClick={() =>
              navigate("compare")
            }
          />
        ) : (
          <div className="history-list">
            {history.map(
              (item, index) => (
                <div
                  className="history-item"
                  key={
                    item.id ||
                    index
                  }
                >
                  <div className="history-index">
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  <div className="history-main">
                    <strong>
                      Product Comparison
                    </strong>

                    <span>
                      {item.created_at ||
                        "Saved comparison"}
                    </span>
                  </div>

                  <div className="history-status">
                    ✓ Completed
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className={
        darkMode
          ? "app dark-mode"
          : "app"
      }
    >
      <Navbar
        activePage={
          activePage
        }
        navigate={
          navigate
        }
        darkMode={
          darkMode
        }
        setDarkMode={
          setDarkMode
        }
      />

      <main>
        {activePage ===
          "dashboard" && (
          <Dashboard />
        )}

        {activePage ===
          "compare" && (
          <ComparePage />
        )}

        {activePage ===
          "saved" && (
          <SavedPage />
        )}

        {activePage ===
          "liked" && (
          <LikedPage />
        )}

        {activePage ===
          "history" && (
          <HistoryPage />
        )}
      </main>

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
          Built with React • Node.js •
          Gemini AI • RAG
        </p>
      </footer>
    </div>
  );
}

/* =========================================================
   NAVBAR
   ========================================================= */

function Navbar({
  activePage,
  navigate,
  darkMode,
  setDarkMode,
}) {
  const links = [
    {
      id: "dashboard",
      label: "Dashboard",
    },
    {
      id: "compare",
      label: "Compare",
    },
    {
      id: "saved",
      label: "Saved",
    },
    {
      id: "liked",
      label: "Liked",
    },
    {
      id: "history",
      label: "History",
    },
  ];

  return (
    <header className="navbar">
      <div
        className="brand"
        onClick={() =>
          navigate("dashboard")
        }
      >
        <div className="brand-mark">
          ✦
        </div>

        <div>
          <strong>
            ProductIQ
          </strong>

          <span>
            AI Comparison
          </span>
        </div>
      </div>

      <nav>
        {links.map(
          (link) => (
            <button
              key={link.id}
              className={
                activePage ===
                link.id
                  ? "nav-link active"
                  : "nav-link"
              }
              onClick={() =>
                navigate(
                  link.id
                )
              }
            >
              {link.label}
            </button>
          )
        )}
      </nav>

      <button
        className="theme-button"
        onClick={() =>
          setDarkMode(
            !darkMode
          )
        }
        title="Toggle theme"
      >
        {darkMode
          ? "☀"
          : "☾"}
      </button>
    </header>
  );
}

/* =========================================================
   FEATURE CARD
   ========================================================= */

function FeatureCard({
  icon,
  title,
  text,
}) {
  return (
    <div className="feature-card">
      <div className="feature-icon">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{text}</p>

      <span className="feature-arrow">
        →
      </span>
    </div>
  );
}

/* =========================================================
   PAGE HEADER
   ========================================================= */

function PageHeader({
  kicker,
  title,
  text,
}) {
  return (
    <div className="page-title">
      <span className="section-kicker">
        {kicker}
      </span>

      <h1>{title}</h1>

      <p>{text}</p>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
   ========================================================= */

function EmptyState({
  icon,
  title,
  text,
  action,
  onClick,
}) {
  return (
    <div className="empty-card large-empty">
      <div className="empty-icon">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{text}</p>

      <button
        className="primary-button"
        onClick={onClick}
      >
        {action}
      </button>
    </div>
  );
}

/* =========================================================
   COLLECTION CARD
   ========================================================= */

function CollectionCard({
  item,
  onDelete,
}) {
  let product =
    item.product ||
    item;

  if (
    typeof product ===
    "string"
  ) {
    try {
      product =
        JSON.parse(
          product
        );
    } catch {
      product = {
        name: product,
      };
    }
  }

  return (
    <div className="collection-card">
      <div className="collection-image">
        <ProductImage
          src={
            product.image
          }
          alt={
            product.name
          }
        />
      </div>

      <div className="collection-info">
        <span className="store-label">
          {product.platform ||
            "Product"}
        </span>

        <h3>
          {product.name ||
            "Product"}
        </h3>

        <div className="collection-meta">
          <strong>
            {money(
              product.price
            )}
          </strong>

          <span>
            ★{" "}
            {rating(
              product.rating
            )}
          </span>
        </div>
      </div>

      <button
        className="remove-button"
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  );
}

/* =========================================================
   LOADING
   ========================================================= */

function LoadingComparison() {
  return (
    <div className="loading-result">
      <div className="loading-header">
        <div className="loading-orb">
          ✦
        </div>

        <div>
          <div className="skeleton title-skeleton"></div>
          <div className="skeleton text-skeleton"></div>
        </div>
      </div>

      <div className="loading-grid">
        <div className="skeleton-card"></div>
        <div className="skeleton-card"></div>
      </div>
    </div>
  );
}

/* =========================================================
   COMPARISON RESULT
   ========================================================= */

function ComparisonResult({
  comparison,
  products,
  onSave,
  onLike,
}) {
  const best =
    comparison?.bestProduct;

  const cheapest =
    comparison?.cheapestProduct;

  const highestRated =
    comparison?.highestRatedProduct;

  const ai =
    comparison?.ai || {};

  return (
    <section className="comparison-result">
      <div className="result-heading">
        <div>
          <span className="section-kicker">
            AI ANALYSIS COMPLETE
          </span>

          <h2>
            Your Comparison
          </h2>
        </div>

        <div className="ai-status">
          <span className="status-dot"></span>
          {comparison?.aiEngine ||
            "AI Analysis"}
        </div>
      </div>

      <div className="winner-banner">
        <div className="winner-icon">
          ♛
        </div>

        <div className="winner-content">
          <span>
            RECOMMENDED WINNER
          </span>

          <h2>
            {best?.name ||
              "Best Product"}
          </h2>

          <p>
            {ai.whyWinner ||
              best?.reason ||
              comparison?.recommendation ||
              "Best overall choice based on available product data."}
          </p>
        </div>

        <div className="winner-score">
          <strong>
            {best?.score ??
              0}
          </strong>

          <span>
            / 100
          </span>

          <small>
            Overall Score
          </small>
        </div>
      </div>

      <div className="quick-stats">
        <QuickStat
          icon="₹"
          title="Best Price"
          value={
            cheapest?.price
              ? money(
                  cheapest.price
                )
              : "N/A"
          }
          subtitle={
            cheapest?.name ||
            ""
          }
        />

        <QuickStat
          icon="★"
          title="Highest Rated"
          value={
            highestRated?.rating
              ? rating(
                  highestRated.rating
                )
              : "N/A"
          }
          subtitle={
            highestRated?.name ||
            ""
          }
        />

        <QuickStat
          icon="↕"
          title="Price Difference"
          value={
            comparison?.priceDifference
              ? money(
                  comparison.priceDifference
                )
              : "₹0"
          }
          subtitle="Between options"
        />

        <QuickStat
          icon="✦"
          title="AI Confidence"
          value={
            ai.confidence ||
            "Medium"
          }
          subtitle="Analysis confidence"
        />
      </div>

      <div className="product-result-grid">
        {products.map(
          (product, index) => (
            <ProductResultCard
              key={
                product.name ||
                index
              }
              product={
                product
              }
              isWinner={
                product.name ===
                best?.name
              }
              isCheapest={
                product.name ===
                cheapest?.name
              }
              isHighestRated={
                product.name ===
                highestRated?.name
              }
              onSave={
                onSave
              }
              onLike={
                onLike
              }
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
                GEMINI AI
              </span>

              <h3>
                AI Recommendation
              </h3>
            </div>
          </div>

          <p>
            {ai.recommendation ||
              comparison?.recommendation ||
              "AI recommendation is not available."}
          </p>

          {ai.bestFor && (
            <div className="best-for">
              <strong>
                Best for
              </strong>

              <span>
                {ai.bestFor}
              </span>
            </div>
          )}
        </div>

        <div className="ai-insight-card">
          <div className="insight-heading">
            <div className="insight-icon">
              ✓
            </div>

            <div>
              <span>
                STRENGTHS
              </span>

              <h3>
                What stands out
              </h3>
            </div>
          </div>

          <ul className="insight-list">
            {(
              ai.pros ||
              []
            )
              .slice(0, 5)
              .map(
                (item, index) => (
                  <li
                    key={index}
                  >
                    <span>
                      ✓
                    </span>
                    {item}
                  </li>
                )
              )}

            {(!ai.pros ||
              ai.pros.length ===
                0) && (
              <li>
                <span>
                  ✓
                </span>
                Detailed product
                data available
              </li>
            )}
          </ul>
        </div>

        <div className="ai-insight-card">
          <div className="insight-heading">
            <div className="insight-icon">
              !
            </div>

            <div>
              <span>
                LIMITATIONS
              </span>

              <h3>
                Keep in mind
              </h3>
            </div>
          </div>

          <ul className="insight-list">
            {(
              ai.cons ||
              []
            )
              .slice(0, 5)
              .map(
                (item, index) => (
                  <li
                    key={index}
                  >
                    <span>
                      !
                    </span>
                    {item}
                  </li>
                )
              )}

            {(!ai.cons ||
              ai.cons.length ===
                0) && (
              <li>
                <span>
                  !
                </span>
                Some retailer
                information may be
                unavailable.
              </li>
            )}
          </ul>
        </div>
      </div>

      <ScoreBreakdown
        comparison={
          comparison
        }
      />

      <SpecificationTable
        products={
          products
        }
        comparison={
          comparison
        }
      />

      <div className="rag-banner">
        <div className="rag-icon">
          ◈
        </div>

        <div>
          <strong>
            RAG Grounded Analysis
          </strong>

          <p>
            AI recommendation is
            grounded in the product
            information extracted from
            the supported stores.
          </p>
        </div>

        <span className="rag-badge">
          RAG ACTIVE
        </span>
      </div>
    </section>
  );
}

/* =========================================================
   QUICK STAT
   ========================================================= */

function QuickStat({
  icon,
  title,
  value,
  subtitle,
}) {
  return (
    <div className="quick-stat">
      <div className="quick-stat-icon">
        {icon}
      </div>

      <div>
        <span>
          {title}
        </span>

        <strong>
          {value}
        </strong>

        <small>
          {subtitle}
        </small>
      </div>
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
  const scores =
    product.scores || {};

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
            ♛ BEST CHOICE
          </span>
        )}

        {isCheapest && (
          <span className="price-badge">
            ₹ BEST PRICE
          </span>
        )}

        {isHighestRated && (
          <span className="rating-badge">
            ★ TOP RATED
          </span>
        )}
      </div>

      <div className="result-image">
        <ProductImage
          src={
            product.image
          }
          alt={
            product.name
          }
        />
      </div>

      <div className="result-product-info">
        <div className="store-row">
          <span>
            {product.platform ||
              "Store"}
          </span>

          <span>
            {product.brand ||
              "Brand"}
          </span>
        </div>

        <h3>
          {product.name}
        </h3>

        <div className="price-rating-row">
          <strong>
            {money(
              product.price
            )}
          </strong>

          <span className="rating-pill">
            ★{" "}
            {rating(
              product.rating
            )}
          </span>
        </div>

        <div className="availability">
          <span className="availability-dot"></span>
          {product.availability ||
            "Availability unknown"}
        </div>

        <div className="score-mini">
          <div>
            <span>
              Overall
            </span>

            <strong>
              {scores.overall ??
                0}
              /100
            </strong>
          </div>

          <div className="score-bar">
            <span
              style={{
                width: `${Math.min(
                  100,
                  scores.overall ||
                    0
                )}%`,
              }}
            ></span>
          </div>
        </div>

        <div className="card-actions">
          <button
            className="save-card-button"
            onClick={() =>
              onSave(
                product
              )
            }
          >
            ♡ Save
          </button>

          <button
            className="like-card-button"
            onClick={() =>
              onLike(
                product
              )
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
   SCORE BREAKDOWN
   ========================================================= */

function ScoreBreakdown({
  comparison,
}) {
  const products =
    comparison?.products ||
    [];

  return (
    <div className="score-section">
      <div className="section-heading compact">
        <div>
          <span className="section-kicker">
            TRANSPARENT SCORING
          </span>

          <h2>
            Why this winner?
          </h2>
        </div>

        <p>
          Price 30% • Specifications
          35% • Rating 20% • Data
          confidence 15%
        </p>
      </div>

      <div className="score-grid">
        {products.map(
          (product, index) => (
            <div
              className="score-card"
              key={
                product.name ||
                index
              }
            >
              <div className="score-card-top">
                <div>
                  <span>
                    {product.platform}
                  </span>

                  <h3>
                    {product.name}
                  </h3>
                </div>

                <strong>
                  {
                    product.scores
                      ?.overall
                  }
                </strong>
              </div>

              <ScoreRow
                label="Price"
                value={
                  product.scores
                    ?.price
                }
              />

              <ScoreRow
                label="Specifications"
                value={
                  product.scores
                    ?.specifications
                }
              />

              <ScoreRow
                label="Rating"
                value={
                  product.scores
                    ?.rating
                }
              />

              <ScoreRow
                label="Data Confidence"
                value={
                  product.scores
                    ?.dataConfidence
                }
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ScoreRow({
  label,
  value,
}) {
  const safeValue =
    Math.max(
      0,
      Math.min(
        100,
        Number(value) || 0
      )
    );

  return (
    <div className="score-row">
      <div>
        <span>
          {label}
        </span>

        <strong>
          {safeValue}
        </strong>
      </div>

      <div className="score-bar">
        <span
          style={{
            width: `${safeValue}%`,
          }}
        ></span>
      </div>
    </div>
  );
}

/* =========================================================
   SPECIFICATION TABLE
   ========================================================= */

function SpecificationTable({
  products,
  comparison,
}) {
  const fields = [
    {
      key: "display",
      label: "Display",
    },
    {
      key: "processor",
      label: "Processor",
    },
    {
      key: "ram",
      label: "RAM",
    },
    {
      key: "storage",
      label: "Storage",
    },
    {
      key: "camera",
      label: "Camera",
    },
    {
      key: "battery",
      label: "Battery",
    },
  ];

  return (
    <div className="spec-section">
      <div className="section-heading compact">
        <div>
          <span className="section-kicker">
            DETAILED ANALYSIS
          </span>

          <h2>
            Specifications
          </h2>
        </div>
      </div>

      <div className="spec-table-wrap">
        <table className="spec-table">
          <thead>
            <tr>
              <th>
                Specification
              </th>

              {products.map(
                (
                  product,
                  index
                ) => (
                  <th
                    key={
                      product.name ||
                      index
                    }
                  >
                    <span>
                      {
                        product.platform
                      }
                    </span>

                    {product.name}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                <strong>
                  Price
                </strong>
              </td>

              {products.map(
                (
                  product,
                  index
                ) => (
                  <td
                    key={index}
                  >
                    <strong className="table-price">
                      {money(
                        product.price
                      )}
                    </strong>
                  </td>
                )
              )}
            </tr>

            <tr>
              <td>
                <strong>
                  Rating
                </strong>
              </td>

              {products.map(
                (
                  product,
                  index
                ) => (
                  <td
                    key={index}
                  >
                    <span className="table-rating">
                      ★{" "}
                      {rating(
                        product.rating
                      )}
                    </span>
                  </td>
                )
              )}
            </tr>

            {fields.map(
              (field) => (
                <tr
                  key={
                    field.key
                  }
                >
                  <td>
                    <strong>
                      {
                        field.label
                      }
                    </strong>
                  </td>

                  {products.map(
                    (
                      product,
                      index
                    ) => (
                      <td
                        key={
                          index
                        }
                      >
                        {product
                          .specifications?.[
                          field.key
                        ] ||
                          "Not available"}
                      </td>
                    )
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}