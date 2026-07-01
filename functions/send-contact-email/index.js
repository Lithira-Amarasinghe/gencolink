// Azure Function: send-contact-email
// Triggered by a Directus Flow when a new contact_submissions item is created.
// Sends a notification email to the Gencolink team via Azure Communication Services.

const { EmailClient } = require('@azure/communication-email');

// ─── Config — set these as Application Settings in the Azure Portal ────────────
const ACS_CONNECTION_STRING = process.env.ACS_CONNECTION_STRING;
// The verified sender address on your custom ACS domain, e.g. noreply@mail.gencolink.com
const SENDER_ADDRESS = process.env.ACS_SENDER_ADDRESS;
// The inbox you want contact leads delivered to
const RECIPIENT_ADDRESS = process.env.CONTACT_RECIPIENT_EMAIL;

module.exports = async function (context, req) {
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  };

  if (req.method === 'OPTIONS') {
    context.res.status = 204;
    return;
  }

  const cors = context.res.headers;

  if (!ACS_CONNECTION_STRING || !SENDER_ADDRESS || !RECIPIENT_ADDRESS) {
    context.log.error('Missing required environment variables: ACS_CONNECTION_STRING, ACS_SENDER_ADDRESS, CONTACT_RECIPIENT_EMAIL');
    context.res = { status: 500, body: 'Server misconfiguration.', headers: cors };
    return;
  }

  const { name, email, company, message } = req.body ?? {};

  if (!name || !email || !company || !message) {
    context.res = { status: 400, body: 'Missing required fields: name, email, company, message.', headers: cors };
    return;
  }

  const client = new EmailClient(ACS_CONNECTION_STRING);

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
      context.log(`Contact email sent. Message ID: ${result.id}`);
      context.res = { status: 200, body: { messageId: result.id }, headers: cors };
    } else {
      context.log.error('ACS email send failed:', JSON.stringify(result.error));
      context.res = { status: 502, body: 'Email delivery failed.', headers: cors };
    }
  } catch (err) {
    context.log.error('Unexpected error sending email:', err);
    context.res = { status: 500, body: 'Internal error.', headers: cors };
  }
};

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
