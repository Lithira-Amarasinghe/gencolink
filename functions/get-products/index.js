/**
 * Azure Function: get-products
 * Returns products from Cosmos DB
 * Cost: FREE (first 1M executions free, 400 RU/s free tier)
 */
const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
  try {
    const client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY,
    });

    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("products");

    // Query all products
    const { resources: products } = await container.items
      .query("SELECT * FROM c ORDER BY c.name")
      .fetchAll();

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
      body: {
        count: products.length,
        items: products,
      },
    };
  } catch (error) {
    context.log.error("Error fetching products:", error);
    context.res = {
      status: 500,
      body: { error: "Failed to fetch products" },
    };
  }
};
