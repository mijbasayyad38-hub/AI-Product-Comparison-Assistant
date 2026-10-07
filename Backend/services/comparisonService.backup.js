function compareProducts(products) {
  if (!products || products.length === 0) {
    return {
      bestProduct: null,
      comparison: []
    };
  }

  const comparison = products.map((product) => {
    return {
      name: product.name,
      platform: product.platform,
      price: product.price,
      rating: product.rating,
      specifications: product.specifications
    };
  });

  return {
    bestProduct: null,
    comparison: comparison
  };
}

module.exports = {
  compareProducts
};