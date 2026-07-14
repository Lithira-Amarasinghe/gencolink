// Azure Function: send-contact-email
// Triggered by a Directus Flow when a new contact_submissions item is created.
// Sends a notification email to the Gencolink team via Azure Communication Services.
//
// Response contract (always JSON, never leaks internal/raw errors):
//   { "success": true,  "message": "..." }                on success
//   { "success": false, "message": "...", "ref": "<id>" } on failure
// The `ref` mirrors the Azure invocation id so a failed response can be traced
// back to the detailed server-side log without exposing internals to the caller.

const { EmailClient } = require('@azure/communication-email');
const { DefaultAzureCredential } = require('@azure/identity');

// Entra ID (Managed Identity) auth - no secret anywhere. In Azure the Function
// App's system-assigned identity is granted "Communication and Email Service
// Owner" on the ACS resource; DefaultAzureCredential picks that identity up
// automatically. Locally it falls back to the developer's `az login` session.
const ACS_ENDPOINT = process.env.ACS_ENDPOINT;
const SENDER_ADDRESS = process.env.ACS_SENDER_ADDRESS;
const RECIPIENT_ADDRESS = process.env.CONTACT_RECIPIENT_EMAIL;

// Built once and reused across warm invocations (token caching lives here).
const credential = new DefaultAzureCredential();

// Field length caps - guard against oversized payloads and email-content abuse.
const LIMITS = { name: 200, email: 320, company: 200, message: 5000 };

// Pragmatic email shape check (not full RFC 5322 - just rejects obvious garbage).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function (context, req) {
  const ref = context.invocationId;

  // CORS is enforced at the platform level (App Service CORS, scoped to the
  // frontend origin in Terraform). This function is called server-to-server
  // by the Directus Flow, so no wildcard origin is set here.
  const respond = (status, success, message) => {
    context.res = {
      status,
      headers: { 'Content-Type': 'application/json' },
      body: success ? { success, message } : { success, message, ref },
    };
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 204 };
    return;
  }

  // Misconfiguration (missing settings) is a server fault, not the caller's.
  if (!ACS_ENDPOINT || !SENDER_ADDRESS || !RECIPIENT_ADDRESS) {
    context.log.error(
      `[${ref}] Missing required settings:`,
      JSON.stringify({
        ACS_ENDPOINT: Boolean(ACS_ENDPOINT),
        ACS_SENDER_ADDRESS: Boolean(SENDER_ADDRESS),
        CONTACT_RECIPIENT_EMAIL: Boolean(RECIPIENT_ADDRESS),
      })
    );
    respond(500, false, 'The email service is temporarily unavailable. Please try again later.');
    return;
  }

  // Body must be a JSON object.
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    respond(400, false, 'Invalid request body. Expected a JSON object.');
    return;
  }

  const validationError = validate(body);
  if (validationError) {
    context.log.warn(`[${ref}] Validation failed: ${validationError}`);
    respond(400, false, validationError);
    return;
  }

  // Normalise (trim) after validation passed.
  const name = body.name.trim();
  const email = body.email.trim();
  const company = body.company.trim();
  const message = body.message.trim();

  const client = new EmailClient(ACS_ENDPOINT, credential);
  const emailMessage = {
    senderAddress: SENDER_ADDRESS,
    recipients: {
      to: [{ address: RECIPIENT_ADDRESS, displayName: 'Gencolink Team' }],
      replyTo: [{ address: email, displayName: name }],
    },
    content: {
      subject: `New contact from ${name} — ${company}`,
      plainText: buildPlainText({ name, email, company, message }),
      html: buildHtml({ name, email, company, message }),
    },
  };

  try {
    const poller = await client.beginSend(emailMessage);
    const result = await poller.pollUntilDone();

    if (result.status === 'Succeeded') {
      context.log(`[${ref}] Contact email sent. ACS message id: ${result.id}`);
      respond(200, true, 'Your message has been sent. Our team will be in touch soon.');
    } else {
      // ACS accepted the request but delivery did not succeed.
      context.log.error(`[${ref}] ACS delivery not succeeded:`, JSON.stringify(result.error ?? result.status));
      respond(502, false, "We couldn't deliver your message right now. Please try again in a few minutes.");
    }
  } catch (err) {
    // Full detail stays server-side only; caller gets a generic message + ref.
    context.log.error(`[${ref}] Unexpected error sending email:`, err);
    respond(500, false, 'Something went wrong while sending your message. Please try again later.');
  }
};

function validate({ name, email, company, message }) {
  const fields = { name, email, company, message };

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || value.trim() === '') {
      return `Missing or invalid field: ${key}.`;
    }
    if (value.length > LIMITS[key]) {
      return `Field "${key}" exceeds the maximum length of ${LIMITS[key]} characters.`;
    }
  }

  if (!EMAIL_RE.test(email.trim())) {
    return 'Please provide a valid email address.';
  }

  return null;
}

function buildPlainText({ name, email, company, message }) {
  return [
    'New contact form submission from gencolink.com',
    '',
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Company: ${company}`,
    '',
    'Message:',
    message,
  ].join('\n');
}

function buildHtml({ name, email, company, message }) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>New Contact</title></head>
<body style="font-family:system-ui,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="margin-top:0">New contact form submission</h2>
  <table style="border-collapse:collapse;width:100%">
    <tr>
      <td style="padding:8px 12px;background:#f4f4f4;font-weight:600;width:100px">Name</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5">${esc(name)}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f4f4f4;font-weight:600">Email</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5">
        <a href="mailto:${esc(email)}">${esc(email)}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f4f4f4;font-weight:600">Company</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5">${esc(company)}</td>
    </tr>
  </table>
  <h3 style="margin-bottom:8px">Message</h3>
  <p style="white-space:pre-wrap;background:#f9f9f9;padding:16px;border-radius:6px;margin:0">${esc(message)}</p>
  <hr style="margin-top:32px;border:none;border-top:1px solid #e5e5e5">
  <p style="font-size:12px;color:#888">Sent from gencolink.com contact form</p>
</body>
</html>`;
}
