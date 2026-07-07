/**
 * Azure Function: get-site-content
 * Returns site content (hero, about, sections) from Blob Storage
 * Cost: FREE (first 1M executions free)
 */
const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.BLOB_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient("site-content");
    const blockBlobClient = containerClient.getBlockBlobClient("site-content.json");

    // Download blob content
    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);

    const content = JSON.parse(downloaded);

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
      body: content,
    };
  } catch (error) {
    context.log.error("Error fetching site content:", error);
    context.res = {
      status: 500,
      body: { error: "Failed to fetch site content" },
    };
  }
};

async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => {
      chunks.push(data.toString("utf8"));
    });
    readableStream.on("end", () => {
      resolve(chunks.join(""));
    });
    readableStream.on("error", reject);
  });
}
