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

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => displayValue(item))
      .join(", ");
  }

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
        const key =
          item.name ||
          item.key ||
          item.label;

        if (key) {
          acc[String(key)] =
            item.value ||
            item.details ||
            item.specification;
        }
      }

      return acc;
    }, {});
  }

  return parsed && typeof parsed === "object"
    ? parsed
    : {};
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
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

        <div className="product-actions">
          <button
            className="outline-btn"
            onClick={() => onSave(product)}
          >
            Save
          </button>

          <button
            className="outline-btn"
            onClick={() => onLike(product)}
          >
            Like
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

const pickProducts = (result) => {
  const candidates = [
    result,
    result?.products,
    result?.items,
    result?.comparedProducts,
    result?.results,
    result?.data?.products,
    result?.comparison?.products,
  ];

  for (const candidate of candidates) {
    const list = parseData(candidate);

    if (Array.isArray(list) && list.length && typeof list[0] !== "undefined") {
      const looksLikeProducts = list.every(
        (item) => parseData(item) && typeof parseData(item) === "object"
      );

      if (looksLikeProducts) {
        return list;
      }
    }
  }

  return [];
};

const pickDetails = (result) => {
  const source = parseData(
    result?.comparisonTable ??
      result?.comparison_table ??
      result?.comparisonDetails ??
      result?.comparison_details ??
      result?.table ??
      (Array.isArray(result?.comparison) ? result.comparison : undefined)
  );

  const rows = [];

  if (Array.isArray(source)) {
    source.forEach((item) => {
      item = parseData(item);

      if (!item || typeof item !== "object") return;

      const labelKey = ["feature", "name", "label", "attribute", "key", "title"].find(
        (k) => item[k]
      );

      if (!labelKey) return;

      const values = Array.isArray(item.values)
        ? item.values
        : Object.entries(item)
            .filter(([k]) => k !== labelKey)
            .map(([, v]) => v);

      rows.push({ label: String(item[labelKey]), values });
    });
  } else if (source && typeof source === "object") {
    Object.entries(source).forEach(([label, value]) => {
      if (Array.isArray(value)) {
        rows.push({ label, values: value });
      } else if (value && typeof value === "object") {
        rows.push({ label, values: Object.values(value) });
      }
    });
  }

  return rows;
};

const readSpecs = (product) => {
  const toObject = (input) => {
    const parsed = parseData(input);

    if (!parsed) return {};

    if (typeof parsed === "string") {
      return toObject(
        parsed.split(/\n|;/).map((l) => l.trim()).filter(Boolean)
      );
    }

    if (Array.isArray(parsed)) {
      return parsed.reduce((acc, item, index) => {
        if (Array.isArray(item) && item.length >= 2) {
          acc[String(item[0])] = item[1];
        } else if (item && typeof item === "object") {
          const key =
            item.name || item.key || item.label || item.title || item.attribute;
          const val =
            item.value ?? item.details ?? item.specification ?? item.description;

          if (key) acc[String(key)] = val;
        } else if (typeof item === "string") {
          const i = item.indexOf(":");

          if (i > 0) acc[item.slice(0, i).trim()] = item.slice(i + 1).trim();
          else acc[`Feature ${index + 1}`] = item;
        }

        return acc;
      }, {});
    }

    return typeof parsed === "object" ? parsed : {};
  };

  return toObject(
    product?.specifications ??
      product?.specs ??
      product?.details ??
      product?.features ??
      product?.technicalDetails ??
      product?.technical_details
  );
};

function ComparisonTable({ products, details = [], onSave, onLike }) {
  const grid = "1px solid rgba(120, 120, 160, 0.45)";

  const cellStyle = {
    border: grid,
    padding: "12px 16px",
    textAlign: "left",
    verticalAlign: "top",
    fontSize: 14,
  };

  const headStyle = {
    ...cellStyle,
    background: "rgba(91, 75, 216, 0.12)",
    fontWeight: 700,
    minWidth: 180,
  };

  const rowHeadStyle = {
    ...cellStyle,
    background: "rgba(91, 75, 216, 0.06)",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  const items = products.map((p) => ({
    ...normalizeProduct(p),
    specs: readSpecs(typeof p === "string" ? parseData(p) : p),
  }));

  const lowerMaps = items.map((p) =>
    Object.fromEntries(
      Object.entries(p.specs).map(([k, v]) => [k.trim().toLowerCase(), v])
    )
  );

  const labels = {};

  items.forEach((p) =>
    Object.keys(p.specs).forEach((k) => {
      const id = k.trim().toLowerCase();

      if (!labels[id]) {
        labels[id] = k
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
    })
  );

  const specIds = Object.keys(labels).sort((a, b) =>
    labels[a].localeCompare(labels[b])
  );

  const rows = [
    { label: "Brand", get: (p) => p.brand },
    { label: "Store / Platform", get: (p) => p.platform },
    { label: "Price", get: (p) => money(p.price) },
    {
      label: "Rating",
      get: (p) => (p.rating ? `★ ${p.rating.toFixed(1)}` : "Not available"),
    },
    { label: "Availability", get: (p) => p.availability },
    ...specIds.map((id) => ({
      label: labels[id],
      get: (p, i) => lowerMaps[i][id],
    })),
  ];

  const known = new Set(rows.map((r) => r.label.trim().toLowerCase()));

  details.forEach((d) => {
    if (known.has(d.label.trim().toLowerCase())) return;

    rows.push({
      label: d.label,
      get: (p, i) => d.values[i],
    });
  });

  return (
    <div className="comparison-table-wrap" style={{ width: "100%", overflowX: "auto" }}>
      <table
        className="comparison-table"
        style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}
      >
        <thead>
          <tr>
            <th scope="col" style={headStyle}>Feature</th>

            {items.map((p, i) => (
              <th scope="col" key={`head-${i}`} style={headStyle}>
                <img
                  src={p.image}
                  alt={p.name}
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK;
                  }}
                  style={{
                    width: 140,
                    height: 105,
                    objectFit: "contain",
                    display: "block",
                    marginBottom: 8,
                  }}
                />

                {p.name}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, r) => (
            <tr key={`row-${r}`}>
              <th scope="row" style={rowHeadStyle}>{row.label}</th>

              {items.map((p, i) => (
                <td key={`cell-${r}-${i}`} style={cellStyle}>{displayValue(row.get(p, i))}</td>
              ))}
            </tr>
          ))}

          <tr>
            <th scope="row" style={rowHeadStyle}>Actions</th>

            {products.map((product, i) => (
              <td key={`actions-${i}`} style={cellStyle}>
                <div className="product-actions">
                  <button className="outline-btn" onClick={() => onSave(product)}>
                    Save
                  </button>

                  <button className="outline-btn" onClick={() => onLike(product)}>
                    Like
                  </button>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
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

  async function loadHistory() {
    try {
      const data = await request("/api/history");

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
      const data = await request("/api/saved");

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
      const data = await request("/api/liked");

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

      const body = data.comparison || data.result;

      setResult(
        body &&
          typeof body === "object" &&
          !Array.isArray(body)
          ? { ...data, ...body }
          : data
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
      setMessage("Saved product removed.");
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
      setMessage("Liked product removed.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function clearHistory() {
    try {
      await request("/api/history", {
        method: "DELETE",
      });

      await loadHistory();
      setMessage("History cleared.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function historyTitle(item) {
    const products = item?.products || [];

    if (products.length >= 2) {
      const first = normalizeProduct(products[0]).name;
      const second = normalizeProduct(products[1]).name;

      return `${first} vs ${second}`;
    }

    return "Product comparison";
  }

  const products = pickProducts(result);
  const details = pickDetails(result);

  const best =
    result?.bestProduct ||
    result?.recommendedProduct ||
    products[0] ||
    {};

  const recommendation =
    result?.recommendation ||
    result?.aiRecommendation ||
    result?.summary ||
    "";

  return (
    <div className="app">
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
      </header>

      {message && (
        <div className="app-message">
          {message}
        </div>
      )}

      {/* DASHBOARD */}

      {page === "dashboard" && (
        <main>
          <section className="hero-section">
            <div className="hero-left">
              <span className="hero-tag">
                AI POWERED PRODUCT COMPARISON
              </span>

              <h1>
                Compare products.
                <br />
                <strong>
                  Choose smarter.
                </strong>
              </h1>

              <p>
                ProductIQ helps you compare
                prices, specifications, ratings
                and AI-powered recommendations.
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
                      <em
                        style={{
                          width: "82%",
                        }}
                      />
                    </i>
                  </div>

                  <div>
                    <span>Specs</span>

                    <i>
                      <em
                        style={{
                          width: "94%",
                        }}
                      />
                    </i>
                  </div>

                  <div>
                    <span>Rating</span>

                    <i>
                      <em
                        style={{
                          width: "90%",
                        }}
                      />
                    </i>
                  </div>
                </div>

                <div className="mini-result">
                  <span>✦</span>

                  AI recommends the best value
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
            <div className="url-input"></div>
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

            <button
              className="primary-btn compare-btn"
              onClick={compare}
              disabled={loading}
            >
              {loading
                ? "Comparing..."
                : "Compare Products"}
            </button>
          </section>

          {result && (
            <section className="result-section">
              <div className="result-heading">
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

              <section
                className="comparison-table-section"
                aria-labelledby="comparison-table-title"
              >
                <div className="products-heading">
                  <div>
                    <span>
                      SPECIFICATION BREAKDOWN
                    </span>

                    <h2 id="comparison-table-title">
                      Comparison Table
                    </h2>
                  </div>
                </div>

                {products.length < 2 ? (
                  <div className="comparison-table-empty">
                    Product specifications could
                    not be displayed because the
                    server returned fewer than two
                    products.
                  </div>
                ) : (
                  <ComparisonTable
                    products={products}
                    details={details}
                    onSave={saveProduct}
                    onLike={likeProduct}
                  />
                )}
              </section>
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
              Your liked
              <br />
              <strong>products.</strong>
            </h1>

            <p>
              Products you marked as
              interesting.
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
