
async function createProductData(url, platform) {
  let productName = "Product";

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36"
      }
    });

    const html = await response.text();

    // 1. Open Graph product name
    const ogTitle =
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
      );

    // 2. Page title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    if (ogTitle && ogTitle[1]) {
      productName = ogTitle[1].trim();
    } else if (titleMatch && titleMatch[1]) {
      productName = titleMatch[1].trim();
    }

    // Clean title
    productName = productName
      .replace(/\s+/g, " ")
      .replace(/\s*[-|]\s*(Amazon\.in|Flipkart).*$/i, "")
      .trim();

  } catch (error) {
    console.log("Product name fetch error:", error.message);
  }

  return {
    url: url,
    platform: platform,
    name: productName || "Product",
    price: 0,
    rating: 0,
    image: "",
    specifications: {
      display: "Not available",
      processor: "Not available",
      ram: "Not available",
      storage: "Not available",
      camera: "Not available",
      battery: "Not available"
    }
  };
}

module.exports = {
  createProductData
};

