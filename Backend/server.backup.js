const { compareProducts } = require("./services/comparisonService");
const { createProductData } = require("./services/productService");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Check whether URL belongs to Amazon or Flipkart
function validateProductUrl(productUrl) {
  try {
    const url = new URL(productUrl);
    const hostname = url.hostname.toLowerCase();

    const isAmazon =
      hostname === "amazon.in" ||
      hostname === "www.amazon.in";

    const isFlipkart =
      hostname === "flipkart.com" ||
      hostname === "www.flipkart.com";

    if (isAmazon) {
      return {
        valid: true,
        platform: "Amazon"
      };
    }

    if (isFlipkart) {
      return {
        valid: true,
        platform: "Flipkart"
      };
    }

    return {
      valid: false,
      platform: "Unknown"
    };

  } catch (error) {
    return {
      valid: false,
      platform: "Invalid URL"
    };
  }
}

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "AI Product Comparison Assistant Backend is running!"
  });
});

// Product comparison route
app.post("/api/compare", (req, res) => {
  const { products } = req.body;

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({
      success: false,
      message: "Products array is required."
    });
  }

  if (products.length < 2) {
    return res.status(400).json({
      success: false,
      message: "Please provide at least 2 product URLs."
    });
  }

  if (products.length > 5) {
    return res.status(400).json({
      success: false,
      message: "Maximum 5 product URLs are allowed."
    });
  }

  const validatedProducts = products.map((productUrl) => {
    const validation = validateProductUrl(productUrl);

    return {
      url: productUrl,
      valid: validation.valid,
      platform: validation.platform
    };
  });

  const invalidProducts = validatedProducts.filter(
    (product) => !product.valid
  );

  if (invalidProducts.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Only Amazon.in and Flipkart.com product URLs are supported.",
      products: validatedProducts
    });
  }

 const productData = validatedProducts.map((product) => {
  return createProductData(product.url, product.platform);
});
const comparisonResult = compareProducts(productData);

res.json({
  success: true,
  message: "Products processed successfully.",
  totalProducts: productData.length,
  products: productData
});
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});