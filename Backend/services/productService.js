const cheerio = require("cheerio");

/* =========================================================
   AI PRODUCT COMPARISON ASSISTANT
   PRODUCT EXTRACTION SERVICE
   Amazon + Flipkart
   ========================================================= */

const DEFAULT_SPECIFICATIONS = {
  display: "Not available",
  processor: "Not available",
  ram: "Not available",
  storage: "Not available",
  camera: "Not available",
  battery: "Not available",
};

/* =========================================================
   BASIC HELPERS
   ========================================================= */

function cleanText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeText(value) {
  if (!value) return "";

  let result = String(value);

  // Repeat a few times because Amazon can contain
  // encoded entities inside encoded entities.
  for (let i = 0; i < 3; i++) {
    result = result
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#x27;/gi, "'")
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#x2F;/gi, "/")
      .replace(/&#47;/gi, "/");
  }

  return cleanText(result);
}

function validSpec(value) {
  if (!value) return false;

  const text = cleanText(value);

  if (!text) return false;

  if (
    text.toLowerCase() === "not available" ||
    text.toLowerCase() === "unknown"
  ) {
    return false;
  }

  return true;
}

function toNumber(value) {
  if (value === undefined || value === null) {
    return 0;
  }

  const text = String(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .trim();

  const match = text.match(/\d+(?:\.\d+)?/);

  if (!match) return 0;

  return parseFloat(match[0]) || 0;
}

/* =========================================================
   PLATFORM
   ========================================================= */

function detectPlatform(url, suppliedPlatform) {
  const lowerUrl = String(url || "").toLowerCase();

  if (
    lowerUrl.includes("amazon.in") ||
    lowerUrl.includes("amzn.in")
  ) {
    return "Amazon";
  }

  if (
    lowerUrl.includes("flipkart.com") ||
    lowerUrl.includes("dl.flipkart.com")
  ) {
    return "Flipkart";
  }

  return suppliedPlatform || "Unknown";
}

/* =========================================================
   JSON-LD
   ========================================================= */

function extractJsonLd($) {
  const products = [];

  $('script[type="application/ld+json"]').each(
    (index, element) => {
      const raw = $(element).contents().text().trim();

      if (!raw) return;

      try {
        const data = JSON.parse(raw);

        function processItem(item) {
          if (!item || typeof item !== "object") {
            return;
          }

          const type = item["@type"];

          const isProduct =
            type === "Product" ||
            (Array.isArray(type) &&
              type.includes("Product"));

          if (isProduct) {
            products.push(item);
          }

          if (Array.isArray(item["@graph"])) {
            item["@graph"].forEach((graphItem) => {
              const graphType =
                graphItem?.["@type"];

              const graphIsProduct =
                graphType === "Product" ||
                (Array.isArray(graphType) &&
                  graphType.includes("Product"));

              if (graphIsProduct) {
                products.push(graphItem);
              }
            });
          }
        }

        if (Array.isArray(data)) {
          data.forEach(processItem);
        } else {
          processItem(data);
        }
      } catch (error) {
        // Ignore invalid JSON-LD blocks.
      }
    }
  );

  return products;
}

/* =========================================================
   IMAGE
   ========================================================= */

function getFirstImage(image) {
  if (!image) return "";

  if (Array.isArray(image)) {
    for (const item of image) {
      if (
        typeof item === "string" &&
        item.startsWith("http")
      ) {
        return item;
      }

      if (
        item &&
        typeof item === "object" &&
        item.url
      ) {
        return item.url;
      }
    }

    return "";
  }

  if (
    typeof image === "object" &&
    image.url
  ) {
    return image.url;
  }

  if (typeof image === "string") {
    return image;
  }

  return "";
}

function extractImage($, platform, jsonProduct) {
  // 1. JSON-LD
  const jsonImage = getFirstImage(
    jsonProduct?.image
  );

  if (
    jsonImage &&
    jsonImage.startsWith("http")
  ) {
    return jsonImage;
  }

  // 2. Open Graph
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:url"]').attr("content");

  if (
    ogImage &&
    ogImage.startsWith("http")
  ) {
    return ogImage;
  }

  // 3. Twitter
  const twitterImage =
    $('meta[name="twitter:image"]').attr("content");

  if (
    twitterImage &&
    twitterImage.startsWith("http")
  ) {
    return twitterImage;
  }

  // 4. Amazon dynamic image
  if (platform === "Amazon") {
    let amazonImage = "";

    $('[data-a-dynamic-image]').each(
      (index, element) => {
        if (amazonImage) return;

        const value =
          $(element).attr("data-a-dynamic-image");

        if (!value) return;

        try {
          const data = JSON.parse(value);
          const keys = Object.keys(data);

          for (const key of keys) {
            if (
              key.startsWith("http") &&
              !key.includes("sprite")
            ) {
              amazonImage = key;
              break;
            }
          }
        } catch (error) {}
      }
    );

    if (amazonImage) {
      return amazonImage;
    }
  }

  // 5. Product image elements
  const selectors = [
    'img[src*="images"]',
    'img[src*="media"]',
    'img[data-src]',
    'img[src]',
  ];

  for (const selector of selectors) {
    const elements = $(selector);

    for (let i = 0; i < elements.length; i++) {
      const element = elements.eq(i);

      const src =
        element.attr("data-src") ||
        element.attr("src");

      if (
        src &&
        src.startsWith("http") &&
        !/logo|icon|sprite/i.test(src)
      ) {
        return src;
      }
    }
  }

  return "";
}

/* =========================================================
   BRAND
   ========================================================= */

function extractBrand($, jsonProduct, productName) {
  // JSON-LD brand
  if (jsonProduct?.brand) {
    if (
      typeof jsonProduct.brand === "string"
    ) {
      const brand = cleanText(
        jsonProduct.brand
      );

      if (brand) return brand;
    }

    if (jsonProduct.brand.name) {
      const brand = cleanText(
        jsonProduct.brand.name
      );

      if (brand) return brand;
    }
  }

  // Amazon byline
  const amazonBrand = cleanText(
    $("#bylineInfo").text()
  );

  if (amazonBrand) {
    const cleaned = amazonBrand
      .replace(/visit the/i, "")
      .replace(/brand:/i, "")
      .replace(/store/i, "")
      .trim();

    if (cleaned) {
      return cleaned;
    }
  }

  // Meta brand
  const metaBrand =
    $('meta[property="product:brand"]').attr(
      "content"
    ) ||
    $('meta[name="brand"]').attr("content");

  if (metaBrand) {
    const brand = cleanText(metaBrand);

    if (brand) return brand;
  }

  // Known brands
  const knownBrands = [
    "Samsung",
    "Apple",
    "OnePlus",
    "Xiaomi",
    "Redmi",
    "Realme",
    "Oppo",
    "Vivo",
    "Motorola",
    "Nothing",
    "Google",
    "Sony",
    "LG",
    "Nokia",
    "HP",
    "Dell",
    "Lenovo",
    "Asus",
    "Acer",
    "MSI",
    "JBL",
    "Boat",
    "Canon",
    "Nikon",
    "Microsoft",
    "Huawei",
    "Honor",
    "Infinix",
    "TCL",
    "Intel",
    "AMD",
  ];

  const lowerName =
    String(productName || "").toLowerCase();

  for (const brand of knownBrands) {
    if (
      lowerName.includes(
        brand.toLowerCase()
      )
    ) {
      return brand;
    }
  }

  return "Unknown";
}

/* =========================================================
   PRODUCT NAME
   ========================================================= */

function extractProductName(
  $,
  platform,
  jsonProduct
) {
  // JSON-LD
  if (jsonProduct?.name) {
    const name = decodeText(
      jsonProduct.name
    );

    if (name.length > 5) {
      return name;
    }
  }

  // Amazon
  if (platform === "Amazon") {
    const amazonTitle = cleanText(
      $("#productTitle").text()
    );

    if (amazonTitle) {
      return decodeText(amazonTitle);
    }
  }

  // Open Graph
  const ogTitle =
    $('meta[property="og:title"]').attr(
      "content"
    );

  if (ogTitle) {
    return decodeText(ogTitle);
  }

  // Flipkart
  const flipkartSelectors = [
    "h1",
    '[class*="VU-ZEz"]',
    '[class*="B_NuCI"]',
    '[class*="yhB1nd"]',
  ];

  for (const selector of flipkartSelectors) {
    const value = cleanText(
      $(selector).first().text()
    );

    if (value.length > 5) {
      return decodeText(value);
    }
  }

  // Title
  const pageTitle = cleanText(
    $("title").text()
  );

  if (pageTitle) {
    return decodeText(
      pageTitle
        .replace(
          /\s*:\s*Amazon\.in.*$/i,
          ""
        )
        .replace(
          /\s*[-|]\s*Flipkart.*$/i,
          ""
        )
    );
  }

  return "Product Not Found";
}

/* =========================================================
   PRICE
   ========================================================= */

function extractJsonLdPrice(product) {
  if (!product?.offers) return 0;

  const offers = Array.isArray(
    product.offers
  )
    ? product.offers
    : [product.offers];

  for (const offer of offers) {
    if (!offer) continue;

    const value =
      offer.price ??
      offer.lowPrice ??
      offer.highPrice;

    const price = toNumber(value);

    if (price > 0) {
      return price;
    }
  }

  return 0;
}

function extractPrice($, platform) {
  const selectors =
    platform === "Amazon"
      ? [
          "#corePriceDisplay_desktop_feature_div .a-price-whole",
          "#corePrice_feature_div .a-price-whole",
          "#priceblock_ourprice",
          "#priceblock_dealprice",
          ".a-price .a-offscreen",
        ]
      : [
          'meta[itemprop="price"]',
          '[itemprop="price"]',
          "._30jeq3",
          ".Nx9bqj",
          "._1_WHN1",
          "._16Jk6d",
        ];

  for (const selector of selectors) {
    const elements = $(selector);

    for (
      let i = 0;
      i < elements.length;
      i++
    ) {
      const element = elements.eq(i);

      const value =
        element.attr("content") ||
        element.text();

      const price = toNumber(value);

      if (
        price > 0 &&
        price < 100000000
      ) {
        return price;
      }
    }
  }

  return 0;
}

/* =========================================================
   RATING
   ========================================================= */

function extractJsonLdRating(product) {
  const value =
    product?.aggregateRating?.ratingValue;

  const rating = parseFloat(value);

  if (
    Number.isFinite(rating) &&
    rating >= 0 &&
    rating <= 5
  ) {
    return rating;
  }

  return 0;
}

function extractRating($, platform) {
  const selectors =
    platform === "Amazon"
      ? [
          "#acrPopover",
          '[data-hook="average-star-rating"]',
          ".a-icon-star .a-icon-alt",
        ]
      : [
          '[itemprop="ratingValue"]',
          "div.XQDdHH",
          "._3LWZlK",
        ];

  for (const selector of selectors) {
    const elements = $(selector);

    for (
      let i = 0;
      i < elements.length;
      i++
    ) {
      const element = elements.eq(i);

      const value =
        element.attr("title") ||
        element.attr("content") ||
        element.text();

      const match = String(
        value || ""
      ).match(
        /([0-5](?:\.\d+)?)/ 
      );

      if (match) {
        const rating =
          parseFloat(match[1]);

        if (
          rating >= 0 &&
          rating <= 5
        ) {
          return rating;
        }
      }
    }
  }

  return 0;
}

/* =========================================================
   AVAILABILITY
   ========================================================= */

function extractAvailability(
  $,
  platform
) {
  const text = cleanText(
    $("body").text()
  );

  if (
    /currently unavailable/i.test(text) ||
    /out of stock/i.test(text)
  ) {
    return "Currently unavailable";
  }

  if (
    /in stock/i.test(text)
  ) {
    return "In Stock";
  }

  return "Unknown";
}

/* =========================================================
   TABLE / ROW EXTRACTION
   ========================================================= */

function getRows($) {
  const rows = [];

  $("tr").each(
    (index, row) => {
      const cells = $(row)
        .find("th, td")
        .map(
          (i, element) =>
            cleanText(
              $(element).text()
            )
        )
        .get()
        .filter(Boolean);

      if (cells.length >= 2) {
        rows.push(cells);
      }
    }
  );

  return rows;
}

function findRowValue(
  rows,
  labels
) {
  for (const cells of rows) {
    if (!cells.length) continue;

    const label = cleanText(
      cells[0]
    ).toLowerCase();

    for (const target of labels) {
      if (
        label === target.toLowerCase() ||
        label.includes(
          target.toLowerCase()
        )
      ) {
        const value = cleanText(
          cells.slice(1).join(" ")
        );

        if (value) {
          return value;
        }
      }
    }
  }

  return "";
}

/* =========================================================
   JSON-LD ADDITIONAL PROPERTIES
   ========================================================= */

function extractAdditionalProperties(
  product,
  specifications
) {
  if (!product?.additionalProperty) {
    return;
  }

  const properties =
    Array.isArray(
      product.additionalProperty
    )
      ? product.additionalProperty
      : [product.additionalProperty];

  for (const property of properties) {
    if (!property) continue;

    const name = cleanText(
      property.name || ""
    ).toLowerCase();

    const value = cleanText(
      property.value || ""
    );

    if (!value) continue;

    if (
      name.includes("display") ||
      name.includes("screen")
    ) {
      specifications.display =
        value;
    } else if (
      name.includes("processor") ||
      name.includes("cpu") ||
      name.includes("chipset")
    ) {
      specifications.processor =
        value;
    } else if (
      name.includes("ram") ||
      name.includes("memory")
    ) {
      specifications.ram =
        value;
    } else if (
      name.includes("storage") ||
      name.includes("hard drive") ||
      name.includes("ssd")
    ) {
      specifications.storage =
        value;
    } else if (
      name.includes("camera") ||
      name.includes("webcam")
    ) {
      specifications.camera =
        value;
    } else if (
      name.includes("battery")
    ) {
      specifications.battery =
        value;
    }
  }
}

/* =========================================================
   TITLE-BASED SPECIFICATION EXTRACTION
   VERY IMPORTANT
   ========================================================= */

function extractFromTitle(
  productName,
  specifications
) {
  const title = decodeText(
    productName
  );

  if (!title) return;

  /* -------------------------------------------------------
     RAM
     ------------------------------------------------------- */

  const ramPatterns = [
    /(\d{1,3})\s*GB\s*RAM\b/i,
    /(\d{1,3})\s*GB\s*\(\s*RAM/i,
    /\(\s*(\d{1,3})\s*GB\s*\//i,
    /-\s*\(\s*(\d{1,3})\s*GB\s*\//i,
  ];

  for (const pattern of ramPatterns) {
    const match =
      title.match(pattern);

    if (match) {
      specifications.ram =
        `${match[1]} GB`;
      break;
    }
  }

  /* -------------------------------------------------------
     STORAGE
     ------------------------------------------------------- */

  const storagePatterns = [
    /(\d+(?:\.\d+)?)\s*(GB|TB)\s*SSD\b/i,
    /(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:storage|hard drive)\b/i,
    /\/\s*(\d+(?:\.\d+)?)\s*(GB|TB)\s*SSD\b/i,
  ];

  for (const pattern of storagePatterns) {
    const match =
      title.match(pattern);

    if (match) {
      specifications.storage =
        `${match[1]} ${match[2]} SSD`;
      break;
    }
  }

  /* -------------------------------------------------------
     PROCESSOR
     ------------------------------------------------------- */

  const processorPatterns = [
    /(Intel\s+Core\s+5(?:\s+\d+\w*)?)/i,

    /(Intel\s+Core\s+i[3579](?:[-\s]\w+)?)/i,

    /(AMD\s+Ryzen\s+[3579](?:\s+\w+)?)/i,

    /(Ryzen\s+[3579](?:\s+\w+)?)/i,

    /(Snapdragon\s+[\w\s-]+)/i,

    /(MediaTek\s+[\w\s-]+)/i,

    /(Apple\s+M[1-9](?:\s+(?:Pro|Max|Ultra))?)/i,
  ];

  for (const pattern of processorPatterns) {
    const match =
      title.match(pattern);

    if (match) {
      const value = cleanText(
        match[1]
      );

      if (
        value &&
        !/span|div|memory|storage/i.test(
          value
        )
      ) {
        specifications.processor =
          value;
        break;
      }
    }
  }

  /* -------------------------------------------------------
     DISPLAY
     ------------------------------------------------------- */

  const displayPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:inch|inches)\b/i,
    /(\d+(?:\.\d+)?)\s*["']/i,
  ];

  for (const pattern of displayPatterns) {
    const match =
      title.match(pattern);

    if (match) {
      specifications.display =
        `${match[1]} Inch`;
      break;
    }
  }

  /* -------------------------------------------------------
     CAMERA
     ------------------------------------------------------- */

  if (
    /FHD\s+Camera/i.test(title)
  ) {
    specifications.camera =
      "FHD Camera";
  } else if (
    /HD\s+Camera/i.test(title)
  ) {
    specifications.camera =
      "HD Camera";
  }

  /* -------------------------------------------------------
     BATTERY
     ------------------------------------------------------- */

  const batteryMatch =
    title.match(
      /(\d+(?:\.\d+)?)\s*(Wh|mAh)\b/i
    );

  if (batteryMatch) {
    specifications.battery =
      `${batteryMatch[1]} ${batteryMatch[2]}`;
  }
}

/* =========================================================
   BODY TEXT SPECIFICATIONS
   ========================================================= */

function extractSpecsFromText(
  $,
  specifications
) {
  const bodyText = cleanText(
    $("body").text()
  );

  if (!bodyText) return;

  /* -------------------------------------------------------
     RAM
     ------------------------------------------------------- */

  if (
    !validSpec(
      specifications.ram
    )
  ) {
    const ramPatterns = [
      /(?:RAM|Memory|Installed RAM|System Memory)\s*[:\-]?\s*(\d{1,3})\s*GB/i,
      /(\d{1,3})\s*GB\s*(?:RAM|DDR4|DDR5|memory)/i,
    ];

    for (const pattern of ramPatterns) {
      const match =
        bodyText.match(pattern);

      if (match) {
        specifications.ram =
          `${match[1]} GB`;
        break;
      }
    }
  }

  /* -------------------------------------------------------
     STORAGE
     ------------------------------------------------------- */

  if (
    !validSpec(
      specifications.storage
    )
  ) {
    const storagePatterns = [
      /(?:Storage|Digital Storage|SSD|Hard Drive|Hard Disk)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(GB|TB)/i,
      /(\d+(?:\.\d+)?)\s*(GB|TB)\s*SSD/i,
    ];

    for (const pattern of storagePatterns) {
      const match =
        bodyText.match(pattern);

      if (match) {
        specifications.storage =
          `${match[1]} ${match[2]}${
            /SSD/i.test(match[0])
              ? " SSD"
              : ""
          }`;

        break;
      }
    }
  }

  /* -------------------------------------------------------
     DISPLAY
     ------------------------------------------------------- */

  if (
    !validSpec(
      specifications.display
    )
  ) {
    const match =
      bodyText.match(
        /(?:Display Size|Screen Size|Display|Screen)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:inch|inches|")/i
      );

    if (match) {
      specifications.display =
        `${match[1]} Inch`;
    }
  }

  /* -------------------------------------------------------
     PROCESSOR
     ------------------------------------------------------- */

  if (
    !validSpec(
      specifications.processor
    )
  ) {
    const processorPatterns = [
      /(?:Processor|CPU|Processor Type|Processor Model)\s*[:\-]?\s*(Intel\s+Core\s+[^\n,|]+)/i,

      /(?:Processor|CPU|Processor Type|Processor Model)\s*[:\-]?\s*(AMD\s+Ryzen\s+[^\n,|]+)/i,

      /(Intel\s+Core\s+[i3579][^\n,|]*)/i,

      /(AMD\s+Ryzen\s+[3579][^\n,|]*)/i,
    ];

    for (const pattern of processorPatterns) {
      const match =
        bodyText.match(pattern);

      if (match) {
        const value =
          cleanText(match[1]);

        if (
          value &&
          !/span|div|memory|storage/i.test(
            value
          )
        ) {
          specifications.processor =
            value;
          break;
        }
      }
    }
  }

  /* -------------------------------------------------------
     CAMERA
     ------------------------------------------------------- */

  if (
    !validSpec(
      specifications.camera
    )
  ) {
    const cameraMatch =
      bodyText.match(
        /(?:Camera|Webcam|Front Camera)\s*[:\-]?\s*([^\n,|]{2,60})/i
      );

    if (cameraMatch) {
      const value =
        cleanText(cameraMatch[1]);

      if (value) {
        specifications.camera =
          value;
      }
    }
  }

  /* -------------------------------------------------------
     BATTERY
     ------------------------------------------------------- */

  if (
    !validSpec(
      specifications.battery
    )
  ) {
    const batteryMatch =
      bodyText.match(
        /(?:Battery Capacity|Battery)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(Wh|mAh)/i
      );

    if (batteryMatch) {
      specifications.battery =
        `${batteryMatch[1]} ${batteryMatch[2]}`;
    }
  }
}

/* =========================================================
   FINAL SPECIFICATION EXTRACTION
   ========================================================= */

function extractSpecifications(
  $,
  jsonProduct,
  productName
) {
  const specifications = {
    ...DEFAULT_SPECIFICATIONS,
  };

  /* -------------------------------------------------------
     1. JSON-LD
     ------------------------------------------------------- */

  extractAdditionalProperties(
    jsonProduct,
    specifications
  );

  /* -------------------------------------------------------
     2. TABLES
     ------------------------------------------------------- */

  const rows = getRows($);

  if (
    !validSpec(
      specifications.display
    )
  ) {
    const value = findRowValue(
      rows,
      [
        "display size",
        "screen size",
        "display",
        "screen",
      ]
    );

    if (value) {
      specifications.display =
        value;
    }
  }

  if (
    !validSpec(
      specifications.processor
    )
  ) {
    const value = findRowValue(
      rows,
      [
        "processor type",
        "processor model",
        "processor",
        "cpu model",
        "cpu",
        "chipset",
      ]
    );

    if (
      value &&
      !/span|div|memory|storage/i.test(
        value
      )
    ) {
      specifications.processor =
        value;
    }
  }

  if (
    !validSpec(
      specifications.ram
    )
  ) {
    const value = findRowValue(
      rows,
      [
        "installed ram",
        "system memory",
        "ram",
        "memory",
      ]
    );

    if (
      value &&
      /\d+\s*GB/i.test(value)
    ) {
      specifications.ram =
        value;
    }
  }

  if (
    !validSpec(
      specifications.storage
    )
  ) {
    const value = findRowValue(
      rows,
      [
        "digital storage",
        "storage capacity",
        "storage",
        "hard drive",
        "hard disk",
        "ssd",
      ]
    );

    if (
      value &&
      /\d+\s*(GB|TB)/i.test(value)
    ) {
      specifications.storage =
        value;
    }
  }

  if (
    !validSpec(
      specifications.camera
    )
  ) {
    const value = findRowValue(
      rows,
      [
        "camera",
        "webcam",
        "front camera",
      ]
    );

    if (value) {
      specifications.camera =
        value;
    }
  }

  if (
    !validSpec(
      specifications.battery
    )
  ) {
    const value = findRowValue(
      rows,
      [
        "battery capacity",
        "battery",
      ]
    );

    if (
      value &&
      /\d+.*(Wh|mAh)/i.test(value)
    ) {
      specifications.battery =
        value;
    }
  }

  /* -------------------------------------------------------
     3. TITLE
     ------------------------------------------------------- */

  extractFromTitle(
    productName,
    specifications
  );

  /* -------------------------------------------------------
     4. META DESCRIPTION
     ------------------------------------------------------- */

  const description =
    cleanText(
      $('meta[name="description"]')
        .attr("content") || ""
    );

  if (description) {
    const temp$ = cheerio.load(
      `<body>${description}</body>`
    );

    extractSpecsFromText(
      temp$,
      specifications
    );
  }

  /* -------------------------------------------------------
     5. BODY TEXT
     ------------------------------------------------------- */

  extractSpecsFromText(
    $,
    specifications
  );

  /* -------------------------------------------------------
     6. TITLE AGAIN
     -------------------------------------------------------
     Title gets final priority because it contains
     the product's actual model configuration.
     ------------------------------------------------------- */

  extractFromTitle(
    productName,
    specifications
  );

  /* -------------------------------------------------------
     7. Prevent bad extraction
     ------------------------------------------------------- */

  for (const key of Object.keys(
    specifications
  )) {
    const value =
      specifications[key];

    if (
      !value ||
      /^(span|div|memory|unknown)$/i.test(
        cleanText(value)
      )
    ) {
      specifications[key] =
        "Not available";
    }
  }

  return specifications;
}

/* =========================================================
   MAIN PRODUCT FETCH
   ========================================================= */

async function createProductData(
  url,
  platform
) {
  const detectedPlatform =
    detectPlatform(
      url,
      platform
    );

  let productName =
    "Product Not Found";

  let brand = "Unknown";

  let price = 0;

  let rating = 0;

  let image = "";

  let availability =
    "Unknown";

  let specifications = {
    ...DEFAULT_SPECIFICATIONS,
  };

  let finalUrl = url;

  try {
    console.log("");
    console.log(
      "=============================================="
    );
    console.log(
      `Fetching ${detectedPlatform} product...`
    );
    console.log(url);

    const response =
      await fetch(url, {
        redirect: "follow",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154 Safari/537.36",

          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

          "Accept-Language":
            "en-IN,en-US;q=0.9,en;q=0.8",

          "Cache-Control":
            "no-cache",

          Pragma:
            "no-cache",
        },
      });

    finalUrl =
      response.url || url;

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const html =
      await response.text();

    console.log(
      `HTML received: ${html.length} characters`
    );

    const $ =
      cheerio.load(html);

    /* -----------------------------------------------------
       JSON-LD
       ----------------------------------------------------- */

    const jsonProducts =
      extractJsonLd($);

    const jsonProduct =
      jsonProducts.length > 0
        ? jsonProducts[0]
        : null;

    /* -----------------------------------------------------
       NAME
       ----------------------------------------------------- */

    productName =
      extractProductName(
        $,
        detectedPlatform,
        jsonProduct
      );

    /* -----------------------------------------------------
       BRAND
       ----------------------------------------------------- */

    brand =
      extractBrand(
        $,
        jsonProduct,
        productName
      );

    /* -----------------------------------------------------
       PRICE
       ----------------------------------------------------- */

    const jsonPrice =
      extractJsonLdPrice(
        jsonProduct
      );

    price =
      jsonPrice > 0
        ? jsonPrice
        : extractPrice(
            $,
            detectedPlatform
          );

    /* -----------------------------------------------------
       RATING
       ----------------------------------------------------- */

    const jsonRating =
      extractJsonLdRating(
        jsonProduct
      );

    rating =
      jsonRating > 0
        ? jsonRating
        : extractRating(
            $,
            detectedPlatform
          );

    /* -----------------------------------------------------
       IMAGE
       ----------------------------------------------------- */

    image =
      extractImage(
        $,
        detectedPlatform,
        jsonProduct
      );

    /* -----------------------------------------------------
       AVAILABILITY
       ----------------------------------------------------- */

    if (
      jsonProduct?.offers?.availability
    ) {
      availability =
        String(
          jsonProduct.offers.availability
        )
          .split("/")
          .pop();
    } else {
      availability =
        extractAvailability(
          $,
          detectedPlatform
        );
    }

    /* -----------------------------------------------------
       SPECIFICATIONS
       ----------------------------------------------------- */

    specifications =
      extractSpecifications(
        $,
        jsonProduct,
        productName
      );

    /* -----------------------------------------------------
       FINAL CLEANUP
       ----------------------------------------------------- */

    productName =
      decodeText(
        productName
      ) ||
      "Product Not Found";

    brand =
      cleanText(brand) ||
      "Unknown";

    image =
      cleanText(image);

    price =
      Number(price) || 0;

    rating =
      Number(rating) || 0;

    console.log(
      "----------------------------------------------"
    );

    console.log(
      "Platform:",
      detectedPlatform
    );

    console.log(
      "Final URL:",
      finalUrl
    );

    console.log(
      "Product:",
      productName
    );

    console.log(
      "Brand:",
      brand
    );

    console.log(
      "Price:",
      price
    );

    console.log(
      "Rating:",
      rating
    );

    console.log(
      "Image:",
      image
        ? "FOUND"
        : "NOT FOUND"
    );

    console.log(
      "Availability:",
      availability
    );

    console.log(
      "Specifications:",
      specifications
    );

    console.log(
      "----------------------------------------------"
    );
  } catch (error) {
    console.log(
      `Product fetch error (${detectedPlatform}):`,
      error.message
    );
  }

  return {
    url,
    finalUrl,
    platform: detectedPlatform,
    name: productName,
    brand,
    price,
    rating,
    image,
    availability,
    specifications,
  };
}

/* =========================================================
   EXPORT
   ========================================================= */

module.exports = {
  createProductData,
};