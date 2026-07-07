/**
 * Azure Function: submit-contact-form
 * Saves contact form submissions to Cosmos DB and sends confirmation email via SendGrid
 * Cost: FREE (first 1M executions free, 400 RU/s free tier)
 *
 * SendGrid Free Tier: 12,500 emails/month (MORE THAN ENOUGH for contact forms)
 */
const { CosmosClient } = require("@azure/cosmos");
const sgMail = require("@sendgrid/mail");

module.exports = async function (context, req) {
  // Validate request body
  if (!req.body || !req.body.name || !req.body.email || !req.body.message) {
    context.res = {
      status: 400,
      body: { error: "Missing required fields: name, email, message" },
    };
    return;
  }

  try {
    const { name, email, message, subject } = req.body;

    // 1. Save to Cosmos DB
    const client = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT,
      key: process.env.COSMOS_KEY,
    });

    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("contact_submissions");

    const submission = {
      id: `submission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      email,
      subject: subject || "Contact Form Submission",
      message,
      createdAt: new Date().toISOString(),
      ipAddress: req.headers["x-forwarded-for"] || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    const { resource: createdItem } = await container.items.create(submission);
    context.log(`Submission saved: ${createdItem.id}`);

    // 2. Send email confirmation via SendGrid (FREE TIER: 12,500/month)
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: process.env.CONTACT_RECIPIENT_EMAIL,
      from: process.env.FROM_EMAIL,
      subject: `New Contact: ${subject || "Contact Form"}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject || "Contact Form")}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        <hr>
        <p>Submitted: ${new Date().toLocaleString()}</p>
      `,
    };

    await sgMail.send(msg);
    context.log(`Email sent to ${process.env.CONTACT_RECIPIENT_EMAIL}`);

    // 3. Send confirmation to user
    const confirmationMsg = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: "We received your message",
      html: `
        <h2>Thank you, ${escapeHtml(name)}!</h2>
        <p>We received your message and will get back to you soon.</p>
        <hr>
        <p>Your message:</p>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `,
    };

    await sgMail.send(confirmationMsg);
    context.log(`Confirmation sent to ${email}`);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        success: true,
        message: "Thank you for your submission!",
        submissionId: createdItem.id,
      },
    };
  } catch (error) {
    context.log.error("Error processing contact form:", error);
    context.res = {
      status: 500,
      body: { error: "Failed to process submission" },
    };
  }
};

// Prevent XSS attacks
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
