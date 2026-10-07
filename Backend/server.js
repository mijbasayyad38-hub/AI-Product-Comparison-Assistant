require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
  createProductData,
} = require("./services/productService");

const {
  compareProducts,
} = require("./services/comparisonService");

const {
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
} = require("./database");

const app = express();

const PORT = Number(process.env.PORT) || 5000;

/* =========================================================
   OPTIONAL LANGCHAIN
   ========================================================= */

let ChatGoogleGenerativeAI = null;

try {
  const langchainGoogle = require("@langchain/google-genai");
  ChatGoogleGenerativeAI =
    langchainGoogle.ChatGoogleGenerativeAI;
} catch (error) {
  console.log(
    "LangChain package not available. Gemini REST fallback will be used."
  );
}

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(
  cors({
    origin: true,
  })
);

app.use(
  express.json({
    limit: "5mb",
  })
);

/* =========================================================
   DATABASE
   ========================================================= */

try {
  initDatabase();
  console.log("Database initialized.");
} catch (error) {
  console.log(
    "Database initialization error:",
    error.message
  );
}

/* =========================================================
   HELPERS
   ========================================================= */

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function errorMessage(error) {
  return (
    error?.message ||
    "Unexpected server error."
  );
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

/* =========================================================
   PLATFORM DETECTION
   ========================================================= */

function detectPlatform(url) {
  try {
    const hostname = new URL(url)
      .hostname
      .toLowerCase();

    if (
      hostname === "amazon.in" ||
      hostname === "www.amazon.in" ||
      hostname === "m.amazon.in" ||
      hostname === "amzn.in" ||
      hostname === "www.amzn.in"
    ) {
      return "Amazon";
    }

    if (
      hostname === "flipkart.com" ||
      hostname === "www.flipkart.com" ||
      hostname === "m.flipkart.com" ||
      hostname === "dl.flipkart.com"
    ) {
      return "Flipkart";
    }

    return null;
  } catch {
    return null;
  }
}

/* =========================================================
   ROOT / HEALTH
   ========================================================= */

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message:
      "AI Product Comparison Assistant Backend is running.",
    status: "ONLINE",
    port: PORT,
  });
});

app.get("/api/test", (_req, res) => {
  res.json({
    success: true,
    message: "API is working correctly.",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "healthy",

    integrations: {
      gemini: Boolean(
        process.env.GEMINI_API_KEY
      ),

      langchain: Boolean(
        ChatGoogleGenerativeAI
      ),
    },

    services: {
      productExtraction: true,
      comparisonEngine: true,
      rag: true,
      aiRecommendation: Boolean(
        process.env.GEMINI_API_KEY
      ),
    },
  });
});

/* =========================================================
   GEMINI REST
   ========================================================= */

async function askGeminiREST(
  prompt,
  options = {}
) {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const model =
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(
      process.env.GEMINI_API_KEY
    )}`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],

        generationConfig: {
          temperature:
            options.temperature ?? 0.2,

          maxOutputTokens:
            options.maxOutputTokens ?? 1800,
        },
      }),
    }
  );

  const raw =
    await response.text();

  let data = {};

  try {
    data = raw
      ? JSON.parse(raw)
      : {};
  } catch {
    throw new Error(
      "Gemini returned invalid JSON."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Gemini HTTP ${response.status}`
    );
  }

  return clean(
    data?.candidates?.[0]
      ?.content?.parts
      ?.map(
        (part) => part.text || ""
      )
      .join("\n")
  );
}

/* =========================================================
   LANGCHAIN GEMINI
   ========================================================= */

async function askGeminiLangChain(
  prompt
) {
  if (
    !process.env.GEMINI_API_KEY ||
    !ChatGoogleGenerativeAI
  ) {
    return null;
  }

  const model =
    new ChatGoogleGenerativeAI({
      apiKey:
        process.env.GEMINI_API_KEY,

      model:
        process.env.GEMINI_MODEL ||
        "gemini-2.5-flash",

      temperature: 0.2,

      maxOutputTokens: 1800,
    });

  const response =
    await model.invoke(prompt);

  if (
    typeof response?.content ===
    "string"
  ) {
    return clean(
      response.content
    );
  }

  if (
    Array.isArray(response?.content)
  ) {
    return clean(
      response.content
        .map((item) => {
          if (
            typeof item === "string"
          ) {
            return item;
          }

          return item?.text || "";
        })
        .join("\n")
    );
  }

  return "";
}

/* =========================================================
   AI CALL
   ========================================================= */

async function askAI(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    if (ChatGoogleGenerativeAI) {
      const result =
        await askGeminiLangChain(
          prompt
        );

      if (result) {
        return result;
      }
    }
  } catch (error) {
    console.log(
      "LangChain Gemini failed:",
      error.message
    );
  }

  try {
    return await askGeminiREST(
      prompt
    );
  } catch (error) {
    console.log(
      "Gemini REST failed:",
      error.message
    );

    return null;
  }
}

/* =========================================================
   JSON PARSER
   ========================================================= */

function parseAIJson(text) {
  if (!text) return null;

  let cleaned = String(text)
    .trim();

  cleaned = cleaned
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");

    if (
      start >= 0 &&
      end > start
    ) {
      try {
        return JSON.parse(
          cleaned.slice(
            start,
            end + 1
          )
        );
      } catch {
        return null;
      }
    }

    return null;
  }
}

/* =========================================================
   RAG DOCUMENT
   ========================================================= */

function createProductDocument(
  product
) {
  const specs =
    product.specifications || {};

  return `
PRODUCT FACT SHEET

Name:
${clean(product.name)}

Brand:
${clean(product.brand)}

Platform:
${clean(product.platform)}

Price:
₹${product.price || "Not available"}

Rating:
${product.rating || "Not available"}

Availability:
${clean(product.availability)}

Display:
${clean(specs.display)}

Processor:
${clean(specs.processor)}

RAM:
${clean(specs.ram)}

Storage:
${clean(specs.storage)}

Camera:
${clean(specs.camera)}

Battery:
${clean(specs.battery)}

URL:
${clean(product.url)}
`.trim();
}

function retrieveRelevantFacts(
  products,
  query = ""
) {
  const queryWords =
    clean(query)
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 2
      );

  const documents =
    products.map(
      (product) => ({
        product,
        text:
          createProductDocument(
            product
          ),
      })
    );

  const scored =
    documents.map(
      (document) => {
        const lower =
          document.text.toLowerCase();

        let score = 0;

        for (
          const word of queryWords
        ) {
          if (
            lower.includes(word)
          ) {
            score++;
          }
        }

        if (
          Number(document.product.price) >
          0
        ) {
          score++;
        }

        if (
          Number(document.product.rating) >
          0
        ) {
          score++;
        }

        return {
          ...document,
          score,
        };
      }
    );

  scored.sort(
    (a, b) =>
      b.score - a.score
  );

  return scored
    .map(
      (item) =>
        item.text
    )
    .join(
      "\n\n-------------------------\n\n"
    );
}

/* =========================================================
   REQUIREMENT ANALYSIS
   ========================================================= */

function inferCategory(text) {
  const rules = [
    [
      "Smartphone",
      /\b(phone|mobile|smartphone|iphone|android)\b/i,
    ],
    [
      "Laptop",
      /\b(laptop|notebook|macbook|chromebook)\b/i,
    ],
    [
      "Headphones",
      /\b(headphones?|earphones?|earbuds?|airpods|headset)\b/i,
    ],
    [
      "Television",
      /\b(tv|television|smart tv)\b/i,
    ],
    [
      "Tablet",
      /\b(tablet|ipad)\b/i,
    ],
    [
      "Camera",
      /\b(camera|dslr|mirrorless)\b/i,
    ],
    [
      "Smartwatch",
      /\b(smartwatch|smart watch)\b/i,
    ],
    [
      "Speaker",
      /\b(speaker|soundbar)\b/i,
    ],
    [
      "Monitor",
      /\b(monitor|display)\b/i,
    ],
  ];

  const found =
    rules.find(
      ([, regex]) =>
        regex.test(text)
    );

  return found
    ? found[0]
    : "General product";
}

function inferBudget(text) {
  const value =
    text.replace(/,/g, "");

  const patterns = [
    /(?:under|below|less than|max(?:imum)?|within|budget(?: of)?|upto|up to)\s*(?:₹|rs\.?|inr)?\s*(\d{3,7})/i,

    /(?:₹|rs\.?|inr)\s*(\d{3,7})/i,

    /(\d{3,7})\s*(?:rupees|rs|inr)/i,
  ];

  for (
    const regex of patterns
  ) {
    const match =
      value.match(regex);

    if (match) {
      return Number(
        match[1]
      );
    }
  }

  return null;
}

function inferSpecs(
  text,
  category
) {
  const rules = [
    ["battery", /battery|backup/i],
    [
      "camera",
      /camera|photography|photos|\bmp\b/i,
    ],
    [
      "performance",
      /performance|gaming|processor|chipset|fast|multitasking/i,
    ],
    [
      "RAM",
      /\bram\b|memory/i,
    ],
    [
      "storage",
      /storage|\bssd\b|\brom\b|\bgb\b|\btb\b/i,
    ],
    [
      "display",
      /display|screen|amoled|oled|refresh rate/i,
    ],
    [
      "sound",
      /sound|audio|bass|noise cancellation/i,
    ],
    [
      "durability",
      /durable|durability|water resistant|waterproof|ip\d{2}/i,
    ],
    [
      "price",
      /cheap|affordable|budget|value|price|under|below/i,
    ],
  ];

  const found =
    rules
      .filter(
        ([, regex]) =>
          regex.test(text)
      )
      .map(
        ([label]) =>
          label
      );

  if (found.length) {
    return [
      ...new Set(found),
    ];
  }

  if (
    category === "Laptop"
  ) {
    return [
      "performance",
      "RAM",
      "storage",
      "battery",
    ];
  }

  if (
    category === "Smartphone"
  ) {
    return [
      "performance",
      "camera",
      "battery",
      "storage",
    ];
  }

  return [
    "price",
    "quality",
    "features",
  ];
}

app.post(
  "/api/analyze-requirement",
  async (req, res) => {
    const requirement =
      clean(
        req.body?.requirement ||
          req.body?.query ||
          req.body?.text
      );

    if (!requirement) {
      return res.status(400).json({
        success: false,
        error:
          "Please enter a product requirement.",
      });
    }

    const category =
      inferCategory(
        requirement
      );

    const budget =
      inferBudget(
        requirement
      );

    const importantSpecs =
      inferSpecs(
        requirement,
        category
      );

    const analysis = {
      category,

      specialization:
        category,

      budget,

      importantSpecs,

      summary:
        `Find and compare ${category.toLowerCase()} options${
          budget
            ? ` within ₹${budget.toLocaleString(
                "en-IN"
              )}`
            : ""
        }, focusing on ${importantSpecs.join(
          ", "
        )}.`,

      originalRequirement:
        requirement,

      analysisMethod:
        "rule-based",
    };

    if (
      process.env.GEMINI_API_KEY
    ) {
      try {
        const output =
          await askAI(
            `
You are a shopping requirement analyst.

Analyze the following requirement.

Return ONLY valid JSON.

Required keys:
category
specialization
budget
importantSpecs
summary

Rules:
- Do not invent products.
- Do not invent prices.
- budget must be a number or null.
- importantSpecs must be an array.
- Keep the summary short.

Requirement:
${requirement}
`
          );

        const parsed =
          parseAIJson(output);

        if (parsed) {
          analysis.category =
            clean(
              parsed.category
            ) ||
            category;

          analysis.specialization =
            clean(
              parsed.specialization
            ) ||
            analysis.category;

          analysis.budget =
            parsed.budget == null
              ? budget
              : Number.isFinite(
                  Number(
                    parsed.budget
                  )
                )
              ? Number(
                  parsed.budget
                )
              : budget;

          if (
            Array.isArray(
              parsed.importantSpecs
            )
          ) {
            analysis.importantSpecs =
              parsed.importantSpecs
                .map(clean)
                .filter(Boolean)
                .slice(0, 10);
          }

          analysis.summary =
            clean(
              parsed.summary
            ) ||
            analysis.summary;

          analysis.analysisMethod =
            "Gemini AI";
        }
      } catch (error) {
        analysis.aiNote =
          `Gemini unavailable; rule-based analysis used. ${errorMessage(
            error
          )}`;
      }
    }

    res.json({
      success: true,
      analysis,
    });
  }
);

/* =========================================================
   NORMALIZE COMPARISON
   ========================================================= */

function normalizeComparison(
  comparison,
  products
) {
  const prices = products
    .map((product) =>
      Number(product?.price)
    )
    .filter(
      (price) =>
        Number.isFinite(price) &&
        price > 0
    );

  const priceDifference =
    prices.length >= 2
      ? Math.abs(
          Math.max(...prices) -
          Math.min(...prices)
        )
      : 0;

  /*
    IMPORTANT:
    These are the official weights
    used by the application.
  */

  comparison.scoring = {
    price: 25,
    specifications: 40,
    rating: 20,
    dataConfidence: 15,
  };

  comparison.priceDifference =
    priceDifference;

  return comparison;
}

/* =========================================================
   AI COMPARISON
   ========================================================= */

async function generateAIComparison(
  comparison,
  products,
  requirement
) {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const ragContext =
      retrieveRelevantFacts(
        products,
        requirement
      );

    const output =
      await askAI(`
You are an expert AI product comparison assistant.

Use ONLY the product facts supplied below.

Do NOT invent:
- prices
- specifications
- ratings
- features
- warranty
- availability

If information is missing, say "Not available".

The deterministic comparison score is already calculated.
Do not change its arithmetic.

Return ONLY valid JSON:

{
  "recommendation": "",
  "whyWinner": "",
  "bestFor": "",
  "pros": [],
  "cons": [],
  "comparisonSummary": "",
  "confidence": "High"
}

User requirement:
${clean(
      requirement ||
        "General comparison"
    )}

RAG PRODUCT FACTS:
${ragContext}

DETERMINISTIC COMPARISON:
${JSON.stringify(
      comparison,
      null,
      2
    )}
`);

    return parseAIJson(output);
  } catch (error) {
    console.log(
      "AI comparison error:",
      error.message
    );

    return null;
  }
}

/* =========================================================
   PRODUCT URL COMPARISON
   ========================================================= */

app.post(
  "/api/compare",
  async (req, res) => {
    const products =
      req.body?.products;

    if (
      !Array.isArray(products) ||
      products.length < 2
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please provide at least two product URLs.",
      });
    }

    if (products.length > 4) {
      return res.status(400).json({
        success: false,
        error:
          "You can compare maximum 4 products.",
      });
    }

    const validatedProducts =
      [];

    for (
      const url of products
    ) {
      if (!isHttpUrl(url)) {
        return res.status(400).json({
          success: false,
          error:
            `Invalid URL: ${url}`,
        });
      }

      const platform =
        detectPlatform(url);

      if (!platform) {
        return res.status(400).json({
          success: false,
          error:
            `Only Amazon India and Flipkart URLs are supported: ${url}`,
        });
      }

      validatedProducts.push({
        url,
        platform,
      });
    }

    try {
      const productData =
        await Promise.all(
          validatedProducts.map(
            async (product) =>
              await createProductData(
                product.url,
                product.platform
              )
          )
        );

      let comparison =
        compareProducts(
          productData
        );

      /*
        FORCE CURRENT SCORING
      */

      comparison =
        normalizeComparison(
          comparison,
          productData
        );

      const ai =
        await generateAIComparison(
          comparison,
          productData,
          req.body?.requirement ||
            ""
        );

      const finalResult = {
        ...comparison,

        ai:
          ai || {
            recommendation:
              comparison.recommendation,

            whyWinner:
              comparison.bestProduct
                ?.reason ||
              "Best overall score based on available product data.",

            bestFor:
              "Users looking for the best overall balance.",

            pros: [],

            cons: [],

            comparisonSummary:
              "Comparison generated using extracted product facts and deterministic scoring.",

            confidence:
              "Medium",
          },

        rag: {
          enabled: true,

          source:
            "Extracted Amazon/Flipkart product facts",

          grounded: true,
        },

        aiEngine:
          ChatGoogleGenerativeAI
            ? "LangChain + Gemini"
            : "Gemini API",

        requirement:
          clean(
            req.body?.requirement ||
              ""
          ),
      };

      try {
        saveHistory(
          JSON.stringify(
            productData
          ),
          JSON.stringify(
            finalResult
          )
        );
      } catch (error) {
        console.log(
          "History save warning:",
          error.message
        );
      }

      res.json({
        success: true,

        comparison:
          finalResult,

        result:
          finalResult,
      });
    } catch (error) {
      console.error(
        "Comparison error:",
        error
      );

      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

/* =========================================================
   DIRECT PRODUCT COMPARISON
   ========================================================= */

app.post(
  "/api/compare-products",
  async (req, res) => {
    const products =
      req.body?.products;

    if (
      !Array.isArray(products) ||
      products.length < 2
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please provide at least two products.",
      });
    }

    if (products.length > 4) {
      return res.status(400).json({
        success: false,
        error:
          "You can compare maximum 4 products.",
      });
    }

    try {
      let comparison =
        compareProducts(
          products
        );

      comparison =
        normalizeComparison(
          comparison,
          products
        );

      const ai =
        await generateAIComparison(
          comparison,
          products,
          req.body?.requirement ||
            ""
        );

      const result = {
        ...comparison,

        ai:
          ai || {
            recommendation:
              comparison.recommendation,

            whyWinner:
              comparison.bestProduct
                ?.reason ||
              "",

            bestFor:
              "Overall value.",

            pros: [],

            cons: [],

            comparisonSummary:
              "Deterministic comparison based on available product data.",

            confidence:
              "Medium",
          },

        rag: {
          enabled: true,
          grounded: true,
        },

        aiEngine:
          ChatGoogleGenerativeAI
            ? "LangChain + Gemini"
            : "Gemini API",
      };

      res.json({
        success: true,

        comparison: result,

        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

/* =========================================================
   AI COMPARE
   ========================================================= */

app.post(
  "/api/ai-compare",
  async (req, res) => {
    const products =
      req.body?.products;

    if (
      !Array.isArray(products) ||
      products.length < 2
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please provide at least two products.",
      });
    }

    try {
      let comparison =
        compareProducts(
          products
        );

      comparison =
        normalizeComparison(
          comparison,
          products
        );

      const ai =
        await generateAIComparison(
          comparison,
          products,
          req.body?.requirement ||
            ""
        );

      const result = {
        ...comparison,

        ai: ai || null,

        rag: {
          enabled: true,
          grounded: true,
        },

        aiEngine:
          ChatGoogleGenerativeAI
            ? "LangChain + Gemini"
            : "Gemini API",
      };

      res.json({
        success: true,

        comparison: result,

        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

/* =========================================================
   HISTORY
   ========================================================= */

app.get(
  "/api/history",
  (_req, res) => {
    try {
      const history =
        getHistory();

      res.json({
        success: true,
        history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          errorMessage(error),
      });
    }
  }
);

app.delete(
  "/api/history",
  (_req, res) => {
    try {
      clearHistory();

      res.json({
        success: true,

        message:
          "History cleared successfully.",
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

/* =========================================================
   SAVED PRODUCTS
   ========================================================= */

app.post(
  "/api/saved",
  (req, res) => {
    try {
      const product =
        req.body?.product ||
        req.body;

      const result =
        saveProduct(product);

      res.json({
        success: true,
        product: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

app.get(
  "/api/saved",
  (_req, res) => {
    try {
      const products =
        getSavedProducts();

      res.json({
        success: true,
        products,
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

app.delete(
  "/api/saved/:id",
  (req, res) => {
    try {
      deleteSavedProduct(
        Number(req.params.id)
      );

      res.json({
        success: true,

        message:
          "Saved product deleted.",
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

/* =========================================================
   LIKED PRODUCTS
   ========================================================= */

app.post(
  "/api/liked",
  (req, res) => {
    try {
      const product =
        req.body?.product ||
        req.body;

      const result =
        saveLikedProduct(product);

      res.json({
        success: true,
        product: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

app.get(
  "/api/liked",
  (_req, res) => {
    try {
      const products =
        getLikedProducts();

      res.json({
        success: true,
        products,
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);

app.delete(
  "/api/liked/:id",
  (req, res) => {
    try {
      deleteLikedProduct(
        Number(req.params.id)
      );

      res.json({
        success: true,

        message:
          "Liked product deleted.",
      });
    } catch (error) {
      res.status(500).json({
        success: false,

        error:
          errorMessage(error),
      });
    }
  }
);
/* =========================================================
   404
   ========================================================= */

app.use(
  (_req, res) => {
    res.status(404).json({
      success: false,

      error:
        "API route not found.",

      availableRoutes: [
        "GET /",
        "GET /api/test",
        "GET /api/health",
        "POST /api/analyze-requirement",
        "POST /api/compare",
        "POST /api/compare-products",
        "POST /api/ai-compare",
        "GET /api/history",
        "DELETE /api/history",
        "POST /api/saved",
        "GET /api/saved",
        "DELETE /api/saved/:id",
        "POST /api/liked",
        "GET /api/liked",
        "DELETE /api/liked/:id",
      ],
    });
  }
);

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {
    console.error(
      "Unhandled error:",
      error
    );

    res.status(500).json({
      success: false,

      error:
        "Internal server error.",
    });
  }
);

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  () => {
    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      "   AI PRODUCT COMPARISON ASSISTANT"
    );
    console.log(
      "=============================================="
    );
    console.log(
      `   Server: http://localhost:${PORT}`
    );
    console.log(
      "   Status: ONLINE"
    );
    console.log(
      `   Gemini: ${
        process.env.GEMINI_API_KEY
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );
    console.log(
      `   LangChain: ${
        ChatGoogleGenerativeAI
          ? "READY"
          : "NOT AVAILABLE"
      }`
    );
    console.log(
      "   RAG: ENABLED"
    );
    console.log(
      "=============================================="
    );
    console.log("");
  }
);
