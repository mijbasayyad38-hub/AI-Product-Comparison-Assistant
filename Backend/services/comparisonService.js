/* =========================================================
   AI PRODUCT COMPARISON ASSISTANT
   Comparison Service
   ========================================================= */

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function cleanText(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "Not available";
  }

  const text = String(value)
    .replace(/\\["'}\]]+/g, "")
    .replace(/["'}\]]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !text ||
    /^(\\"?\]?\}?"?|\]\}?)$/i.test(text) ||
    /^(span|div)$/i.test(text)
  ) {
    return "Not available";
  }

  return text;
}

function isAvailable(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return false;
  }

  const text = String(value)
    .trim()
    .toLowerCase();

  if (
    text === "not available" ||
    text === "unknown" ||
    text === "n/a" ||
    text === "na" ||
    text === "null" ||
    text === "undefined"
  ) {
    return false;
  }

  if (
    /^["'\\\]\}]+$/.test(text) ||
    text.includes('" }]') ||
    text.includes('"}]') ||
    text === '"]' ||
    text === '"}]'
  ) {
    return false;
  }

  return true;
}

/* ---------------------------------------------------------
   Numeric parsers
   --------------------------------------------------------- */

function extractNumber(value) {
  if (!isAvailable(value)) return 0;

  const match = String(value).match(
    /(\d+(?:\.\d+)?)/
  );

  return match
    ? parseFloat(match[1])
    : 0;
}

function extractGB(value) {
  if (!isAvailable(value)) return 0;

  const text = String(value).toLowerCase();

  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(gb|tb)/
  );

  if (!match) return 0;

  let number = parseFloat(match[1]);

  if (match[2] === "tb") {
    number *= 1024;
  }

  return number;
}

function extractDisplaySize(value) {
  if (!isAvailable(value)) return 0;

  const match = String(value).match(
    /(\d+(?:\.\d+)?)\s*(?:inch|inches|")/i
  );

  return match
    ? parseFloat(match[1])
    : 0;
}

function extractBattery(value) {
  if (!isAvailable(value)) return 0;

  const match = String(value).match(
    /(\d+(?:\.\d+)?)\s*(wh|mah)/i
  );

  if (!match) return 0;

  let number = parseFloat(match[1]);

  if (match[2].toLowerCase() === "mah") {
    number = number / 1000;
  }

  return number;
}

/* ---------------------------------------------------------
   Camera quality
   --------------------------------------------------------- */

function cameraScore(value) {
  if (!isAvailable(value)) return 0;

  const text = String(value).toLowerCase();

  if (
    text.includes("4k") ||
    text.includes("2160")
  ) {
    return 100;
  }

  if (
    text.includes("fhd") ||
    text.includes("1080")
  ) {
    return 90;
  }

  if (
    text.includes("2mp")
  ) {
    return 70;
  }

  if (
    text.includes("hd") ||
    text.includes("720")
  ) {
    return 60;
  }

  const number = extractNumber(text);

  if (number > 0) {
    return Math.min(100, number * 10);
  }

  return 30;
}

/* ---------------------------------------------------------
   Processor strength
   --------------------------------------------------------- */

function processorScore(value) {
  if (!isAvailable(value)) return 0;

  const text = String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  let score = 0;

  /*
     Intel
  */

  if (
    text.includes("core ultra 9") ||
    /\bi9\b/.test(text)
  ) {
    score = 100;
  } else if (
    text.includes("core ultra 7") ||
    /\bi7\b/.test(text)
  ) {
    score = 85;
  } else if (
    text.includes("core ultra 5") ||
    /\bi5\b/.test(text)
  ) {
    score = 75;
  } else if (
    /\bi3\b/.test(text)
  ) {
    score = 55;
  }

  /*
     Intel Core 5
  */

  if (
    text.includes("intel core 5") &&
    score < 70
  ) {
    score = 70;
  }

  /*
     AMD Ryzen
  */

  if (
    text.includes("ryzen 9")
  ) {
    score = Math.max(score, 100);
  } else if (
    text.includes("ryzen 7")
  ) {
    score = Math.max(score, 85);
  } else if (
    text.includes("ryzen 5")
  ) {
    score = Math.max(score, 75);
  } else if (
    text.includes("ryzen 3")
  ) {
    score = Math.max(score, 55);
  }

  /*
     Apple Silicon
  */

  const appleMatch =
    text.match(/\bm([1-5])\b/i);

  if (appleMatch) {
    score = Math.max(
      score,
      55 +
        Number(appleMatch[1]) * 8
    );
  }

  /*
     Celeron / Pentium / Athlon
  */

  if (
    text.includes("celeron") ||
    text.includes("pentium") ||
    text.includes("athlon")
  ) {
    score = Math.max(score, 25);
  }

  return score;
}

/* ---------------------------------------------------------
   Compare one specification
   --------------------------------------------------------- */

function compareSpecification(
  products,
  key,
  parser,
  higherIsBetter = true
) {
  const values = products.map(
    (product) => {
      const specification =
        cleanText(
          product.specifications?.[key]
        );

      return {
        product,
        raw: specification,
        value: parser(specification),
      };
    }
  );

  const available =
    values.filter(
      (item) => item.value > 0
    );

  /*
     If only one product has usable data,
     do NOT declare it the winner.
  */

  if (
    available.length < 2
  ) {
    return {
      winner: null,
      values,
    };
  }

  available.sort(
    (a, b) =>
      higherIsBetter
        ? b.value - a.value
        : a.value - b.value
  );

  /*
     If values are equal, no winner.
  */

  if (
    available.length >= 2 &&
    available[0].value ===
      available[1].value
  ) {
    return {
      winner: null,
      values,
    };
  }

  return {
    winner:
      available[0].product,
    values,
  };
}

/* ---------------------------------------------------------
   Specification comparison
   --------------------------------------------------------- */

function buildSpecificationComparison(
  products
) {
  const fields = [
    {
      key: "display",
      label: "Display",
      parser: extractDisplaySize,
      higherIsBetter: true,
    },
    {
      key: "processor",
      label: "Processor",
      parser: processorScore,
      higherIsBetter: true,
    },
    {
      key: "ram",
      label: "RAM",
      parser: extractGB,
      higherIsBetter: true,
    },
    {
      key: "storage",
      label: "Storage",
      parser: extractGB,
      higherIsBetter: true,
    },
    {
      key: "battery",
      label: "Battery",
      parser: extractBattery,
      higherIsBetter: true,
    },
    {
      key: "camera",
      label: "Camera",
      parser: cameraScore,
      higherIsBetter: true,
    },
  ];

  return fields.map(
    (field) => {
      const comparison =
        compareSpecification(
          products,
          field.key,
          field.parser,
          field.higherIsBetter
        );

      return {
        key: field.key,

        label: field.label,

        winner:
          comparison.winner
            ? comparison.winner.name
            : null,

        values:
          comparison.values.map(
            (item) => ({
              product:
                item.product.name,

              value:
                item.raw,

              numericValue:
                item.value,
            })
          ),
      };
    }
  );
}

/* ---------------------------------------------------------
   Price score
   --------------------------------------------------------- */

function calculatePriceScores(
  products
) {
  const available =
    products.filter(
      (product) =>
        safeNumber(product.price) > 0
    );

  if (
    available.length === 0
  ) {
    return products.map(
      () => 0
    );
  }

  const prices =
    available.map(
      (product) =>
        safeNumber(
          product.price
        )
    );

  const minPrice =
    Math.min(...prices);

  const maxPrice =
    Math.max(...prices);

  return products.map(
    (product) => {
      const price =
        safeNumber(
          product.price
        );

      if (price <= 0) {
        return 0;
      }

      if (
        maxPrice === minPrice
      ) {
        return 100;
      }

      /*
         Minimum price = 100
         Maximum price = 40

         This avoids price completely
         dominating the comparison.
      */

      return Math.round(
        100 -
          ((price - minPrice) /
            (maxPrice - minPrice)) *
            60
      );
    }
  );
}

/* ---------------------------------------------------------
   Rating score
   --------------------------------------------------------- */

function calculateRatingScores(
  products
) {
  return products.map(
    (product) => {
      const rating =
        safeNumber(
          product.rating
        );

      if (rating <= 0) {
        return 0;
      }

      return Math.min(
        100,
        (rating / 5) * 100
      );
    }
  );
}

/* ---------------------------------------------------------
   Specification score
   --------------------------------------------------------- */

function calculateSpecificationScores(
  products
) {
  const fields = [
    {
      key: "ram",
      parser: extractGB,
      weight: 25,
    },
    {
      key: "storage",
      parser: extractGB,
      weight: 20,
    },
    {
      key: "processor",
      parser: processorScore,
      weight: 25,
    },
    {
      key: "display",
      parser: extractDisplaySize,
      weight: 10,
    },
    {
      key: "battery",
      parser: extractBattery,
      weight: 10,
    },
    {
      key: "camera",
      parser: cameraScore,
      weight: 10,
    },
  ];

  const scores =
    products.map(
      () => 0
    );

  const totalWeights =
    products.map(
      () => 0
    );

  for (
    const field of fields
  ) {
    const values =
      products.map(
        (product) =>
          field.parser(
            product
              .specifications?.[
              field.key
            ]
          )
      );

    const available =
      values.filter(
        (value) =>
          value > 0
      );

    if (
      available.length === 0
    ) {
      continue;
    }

    const maxValue =
      Math.max(
        ...available
      );

    if (
      maxValue <= 0
    ) {
      continue;
    }

    values.forEach(
      (value, index) => {
        if (value > 0) {
          scores[index] +=
            (value /
              maxValue) *
            field.weight;

          totalWeights[index] +=
            field.weight;
        }
      }
    );
  }

  return scores.map(
    (score, index) => {
      if (
        totalWeights[index] ===
        0
      ) {
        return 0;
      }

      return (
        score /
        totalWeights[index]
      ) *
        100;
    }
  );
}

/* ---------------------------------------------------------
   Data confidence
   --------------------------------------------------------- */

function calculateConfidence(
  product
) {
  const fields = [
    product.name,
    product.brand,
    product.price,
    product.rating,
    product.image,
    product.availability,
    product.specifications
      ?.display,
    product.specifications
      ?.processor,
    product.specifications
      ?.ram,
    product.specifications
      ?.storage,
    product.specifications
      ?.camera,
    product.specifications
      ?.battery,
  ];

  let available = 0;

  for (
    const field of fields
  ) {
    if (
      field !== undefined &&
      field !== null &&
      field !== "" &&
      field !== 0 &&
      field !== "Unknown" &&
      field !== "Not available" &&
      isAvailable(field)
    ) {
      available++;
    }
  }

  if (
    fields.length === 0
  ) {
    return 0;
  }

  return Math.round(
    (available /
      fields.length) *
      100
  );
}

/* ---------------------------------------------------------
   Pros
   --------------------------------------------------------- */

function generatePros(
  product,
  allProducts
) {
  const pros = [];

  const price =
    safeNumber(
      product.price
    );

  const prices =
    allProducts
      .map(
        (item) =>
          safeNumber(
            item.price
          )
      )
      .filter(
        (value) =>
          value > 0
      );

  if (
    price > 0 &&
    prices.length > 1 &&
    price ===
      Math.min(...prices)
  ) {
    pros.push(
      "Lowest price"
    );
  }

  const rating =
    safeNumber(
      product.rating
    );

  const ratings =
    allProducts
      .map(
        (item) =>
          safeNumber(
            item.rating
          )
      )
      .filter(
        (value) =>
          value > 0
      );

  if (
    rating > 0 &&
    ratings.length > 1 &&
    rating ===
      Math.max(...ratings)
  ) {
    pros.push(
      "Highest rating"
    );
  }

  const specs =
    product.specifications ||
    {};

  if (
    extractGB(
      specs.ram
    ) >= 16
  ) {
    pros.push(
      "High RAM capacity"
    );
  }

  if (
    extractGB(
      specs.storage
    ) >= 512
  ) {
    pros.push(
      "Good storage capacity"
    );
  }

  if (
    processorScore(
      specs.processor
    ) >= 70
  ) {
    pros.push(
      "Strong processor"
    );
  }

  if (
    cameraScore(
      specs.camera
    ) >= 80
  ) {
    pros.push(
      "High-quality camera"
    );
  }

  if (
    extractDisplaySize(
      specs.display
    ) >= 15
  ) {
    pros.push(
      "Large display"
    );
  }

  return pros.slice(
    0,
    5
  );
}

/* ---------------------------------------------------------
   Cons
   --------------------------------------------------------- */

function generateCons(
  product,
  allProducts
) {
  const cons = [];

  const price =
    safeNumber(
      product.price
    );

  const prices =
    allProducts
      .map(
        (item) =>
          safeNumber(
            item.price
          )
      )
      .filter(
        (value) =>
          value > 0
      );

  if (
    price > 0 &&
    prices.length > 1 &&
    price ===
      Math.max(...prices)
  ) {
    cons.push(
      "Higher price"
    );
  }

  const rating =
    safeNumber(
      product.rating
    );

  const ratings =
    allProducts
      .map(
        (item) =>
          safeNumber(
            item.rating
          )
      )
      .filter(
        (value) =>
          value > 0
      );

  if (
    rating > 0 &&
    ratings.length > 1 &&
    rating ===
      Math.min(...ratings)
  ) {
    cons.push(
      "Lowest rating"
    );
  }

  const specs =
    product.specifications ||
    {};

  if (
    !isAvailable(
      specs.ram
    )
  ) {
    cons.push(
      "RAM information unavailable"
    );
  }

  if (
    !isAvailable(
      specs.display
    )
  ) {
    cons.push(
      "Display information unavailable"
    );
  }

  if (
    !isAvailable(
      specs.battery
    )
  ) {
    cons.push(
      "Battery information unavailable"
    );
  }

  if (
    !isAvailable(
      specs.camera
    )
  ) {
    cons.push(
      "Camera information unavailable"
    );
  }

  if (
    cons.length === 0
  ) {
    cons.push(
      "No major disadvantage detected"
    );
  }

  return cons.slice(
    0,
    5
  );
}

/* ---------------------------------------------------------
   Overall score
   --------------------------------------------------------- */

function calculateOverallScores(
  products
) {
  const priceScores =
    calculatePriceScores(
      products
    );

  const ratingScores =
    calculateRatingScores(
      products
    );

  const specificationScores =
    calculateSpecificationScores(
      products
    );

  return products.map(
    (product, index) => {
      const confidence =
        calculateConfidence(
          product
        );

      /*
         Balanced scoring:

         Price          25%
         Specifications 40%
         Rating         20%
         Data confidence 15%
      */

      const score =
        priceScores[index] *
          0.25 +

        specificationScores[index] *
          0.40 +

        ratingScores[index] *
          0.20 +

        confidence *
          0.15;

      return {
        product,

        priceScore:
          Math.round(
            priceScores[index]
          ),

        specificationScore:
          Math.round(
            specificationScores[index]
          ),

        ratingScore:
          Math.round(
            ratingScores[index]
          ),

        confidenceScore:
          confidence,

        overallScore:
          Math.round(score),
      };
    }
  );
}

/* ---------------------------------------------------------
   Find highest rated
   --------------------------------------------------------- */

function findHighestRated(
  products
) {
  const available =
    products.filter(
      (product) =>
        safeNumber(
          product.rating
        ) > 0
    );

  if (
    available.length === 0
  ) {
    return products[0] || null;
  }

  return available.reduce(
    (best, current) =>
      safeNumber(
        current.rating
      ) >
      safeNumber(
        best.rating
      )
        ? current
        : best
  );
}

/* ---------------------------------------------------------
   Find cheapest
   --------------------------------------------------------- */

function findCheapest(
  products
) {
  const available =
    products.filter(
      (product) =>
        safeNumber(
          product.price
        ) > 0
    );

  if (
    available.length === 0
  ) {
    return products[0] || null;
  }

  return available.reduce(
    (best, current) =>
      safeNumber(
        current.price
      ) <
      safeNumber(
        best.price
      )
        ? current
        : best
  );
}

/* ---------------------------------------------------------
   Main comparison
   --------------------------------------------------------- */

function compareProducts(
  products
) {
  if (
    !Array.isArray(products)
  ) {
    throw new Error(
      "Products must be an array."
    );
  }

  if (
    products.length < 2
  ) {
    throw new Error(
      "At least two products are required."
    );
  }

  const cleanProducts =
    products.map(
      (product) => ({
        ...product,

        name:
          cleanText(
            product.name
          ),

        brand:
          cleanText(
            product.brand
          ),

        price:
          safeNumber(
            product.price
          ),

        rating:
          safeNumber(
            product.rating
          ),

        image:
          cleanText(
            product.image
          ),

        availability:
          cleanText(
            product.availability
          ),

        specifications: {
          display:
            cleanText(
              product
                .specifications
                ?.display
            ),

          processor:
            cleanText(
              product
                .specifications
                ?.processor
            ),

          ram:
            cleanText(
              product
                .specifications
                ?.ram
            ),

          storage:
            cleanText(
              product
                .specifications
                ?.storage
            ),

          camera:
            cleanText(
              product
                .specifications
                ?.camera
            ),

          battery:
            cleanText(
              product
                .specifications
                ?.battery
            ),
        },
      })
    );

  const scoredProducts =
    calculateOverallScores(
      cleanProducts
    );

  scoredProducts.sort(
    (a, b) =>
      b.overallScore -
      a.overallScore
  );

  const bestScored =
    scoredProducts[0];

  const bestProduct =
    bestScored.product;

  const cheapestProduct =
    findCheapest(
      cleanProducts
    );

  const highestRatedProduct =
    findHighestRated(
      cleanProducts
    );

  const specificationComparison =
    buildSpecificationComparison(
      cleanProducts
    );

  /* -------------------------------------------------------
     CORRECT PRICE DIFFERENCE
     ------------------------------------------------------- */

  let priceDifference = 0;

  if (
    cleanProducts.length >= 2
  ) {
    const prices =
      cleanProducts
        .map(
          (product) =>
            safeNumber(
              product.price
            )
        )
        .filter(
          (price) =>
            price > 0
        );

    if (
      prices.length >= 2
    ) {
      priceDifference =
        Math.abs(
          Math.max(...prices) -
          Math.min(...prices)
        );
    }
  }

  /* -------------------------------------------------------
     Advantages
     ------------------------------------------------------- */

  const advantages = {};

  for (
    const product of
      cleanProducts
  ) {
    const productAdvantages =
      [];

    const productName =
      product.name;

    for (
      const comparison of
        specificationComparison
    ) {
      if (
        comparison.winner ===
        productName
      ) {
        productAdvantages.push(
          `${comparison.label} advantage`
        );
      }
    }

    if (
      cheapestProduct &&
      cheapestProduct.name ===
        productName
    ) {
      productAdvantages.push(
        "Best price"
      );
    }

    if (
      highestRatedProduct &&
      highestRatedProduct.name ===
        productName
    ) {
      productAdvantages.push(
        "Highest customer rating"
      );
    }

    advantages[
      productName
    ] =
      productAdvantages;
  }

  /* -------------------------------------------------------
     Product details
     ------------------------------------------------------- */

  const productDetails =
    scoredProducts.map(
      (item) => ({
        name:
          item.product.name,

        brand:
          item.product.brand,

        platform:
          item.product.platform,

        price:
          item.product.price,

        rating:
          item.product.rating,

        image:
          item.product.image,

        availability:
          item.product.availability,

        specifications:
          item.product.specifications,

        scores: {
          price:
            item.priceScore,

          specifications:
            item.specificationScore,

          rating:
            item.ratingScore,

          dataConfidence:
            item.confidenceScore,

          overall:
            item.overallScore,
        },

        pros:
          generatePros(
            item.product,
            cleanProducts
          ),

        cons:
          generateCons(
            item.product,
            cleanProducts
          ),

        advantages:
          advantages[
            item.product.name
          ] || [],
      })
    );

  /* -------------------------------------------------------
     Recommendation
     ------------------------------------------------------- */

  let recommendation =
    `${bestProduct.name} is the recommended choice because it provides the best overall balance of price, specifications, rating and available product data.`;

  if (
    cheapestProduct &&
    cheapestProduct.name ===
      bestProduct.name
  ) {
    recommendation =
      `${bestProduct.name} is the recommended choice because it achieves the highest overall score and offers the lowest price among the compared products.`;
  }

  /* -------------------------------------------------------
     Final result
     ------------------------------------------------------- */

  return {
    products:
      productDetails,

    bestProduct: {
      name:
        bestProduct.name,

      platform:
        bestProduct.platform,

      score:
        bestScored.overallScore,

      reason:
        recommendation,
    },

    cheapestProduct:
      cheapestProduct
        ? {
            name:
              cheapestProduct.name,

            platform:
              cheapestProduct.platform,

            price:
              cheapestProduct.price,
          }
        : null,

    highestRatedProduct:
      highestRatedProduct
        ? {
            name:
              highestRatedProduct.name,

            platform:
              highestRatedProduct.platform,

            rating:
              highestRatedProduct.rating,
          }
        : null,

    priceDifference,

    specificationComparison,

    recommendation,

    scoring: {
      price: 25,
      specifications: 40,
      rating: 20,
      dataConfidence: 15,
    },

    generatedAt:
      new Date().toISOString(),
  };
}

module.exports = {
  compareProducts,
};