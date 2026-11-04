import { createHash } from 'node:crypto';

const RECIPIENT = 'support@cyberbench.io';
const MAX_BYTES = 65536;
const EMAIL = /^[^\s<>@,;"\\]+@[^\s<>@,;"\\]+\.[^\s<>@,;"\\]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

function textField(body, name, max, optional = false, multiline = false) {
  const value = body[name] ?? '';
  if (typeof value !== 'string') throw new Error(`Invalid ${name}.`);
  const trimmed = value.trim();
  const controls = multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/;
  if ((!optional && !trimmed) || trimmed.length > max || controls.test(trimmed)) {
    throw new Error(`Please check ${name} (maximum ${max} characters).`);
  }
  return trimmed;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const reply = (status, body) => res.status(status).json(body);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405, { error: 'Use POST to submit a request.' });
  }
  // Origin checking and the hidden field reduce browser spam; they are not a rate limiter.
  const origins = (process.env.TICKET_ALLOWED_ORIGINS ||
    'https://cyberbench.io,https://www.cyberbench.io').split(',').map((s) => s.trim());
  if (!origins.includes(req.headers.origin)) {
    return reply(403, { error: 'Please submit from the CyberBench website.' });
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    return reply(415, { error: 'JSON request required.' });
  }
  let body;
  let ticket;
  try {
    const raw = req.body;
    const encoded = typeof raw === 'string' ? raw : Buffer.isBuffer(raw)
      ? raw.toString('utf8') : JSON.stringify(raw);
    if (!encoded || Buffer.byteLength(encoded) > MAX_BYTES) {
      return reply(413, { error: 'Request is too large.' });
    }
    body = JSON.parse(encoded);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request.');
    if (body.website) throw new Error('Unable to submit this request.');
    ticket = {
      company: textField(body, 'company', 200),
      fullname: textField(body, 'fullname', 150),
      email: textField(body, 'email', 254),
      phone: textField(body, 'phone', 60, true),
      urgency: textField(body, 'urgency', 10),
      description: textField(body, 'description', 10000, false, true),
      requestId: textField(body, 'requestId', 36).toLowerCase(),
    };
    if (!EMAIL.test(ticket.email)) throw new Error('Please enter a valid email address.');
    if (!['low', 'medium', 'high', 'critical'].includes(ticket.urgency)) throw new Error('Choose an urgency level.');
    if (!UUID.test(ticket.requestId)) throw new Error('Please refresh the page and try again.');
  } catch (error) {
    return reply(400, { error: error instanceof SyntaxError ? 'Invalid JSON request.' : error.message });
  }
  const key = process.env.RESEND_API_KEY?.trim();
  const sender = process.env.CYBERBENCH_EMAIL_FROM?.trim();
  if (!key || !sender || /[\r\n]/.test(sender)) {
    console.error('Ticket email configuration is missing or invalid.');
    return reply(503, { error: 'Email is temporarily unavailable. Contact support@cyberbench.io.' });
  }
  const reference = `CB-WEB-${ticket.requestId}`;
  const fields = [
    ['Reference', reference], ['Company', ticket.company], ['Name', ticket.fullname],
    ['Email', ticket.email], ['Phone', ticket.phone || 'Not provided'],
    ['Urgency', ticket.urgency.toUpperCase()],
  ];
  const text = ['NEW CYBERBENCH WEBSITE REQUEST', '',
    ...fields.map(([label, value]) => `${label}: ${value}`), '', 'ISSUE DESCRIPTION',
    ticket.description, '', 'Reply to this email to contact the requester.',
    'Source: CyberBench public Submit Ticket form. Customer details are unverified.',
  ].join('\n');
  const rows = fields.map(([label, value]) => `<tr><th align="left" style="padding:10px;border-bottom:1px solid #dbe5ef;color:#526477">${label}</th><td style="padding:10px;border-bottom:1px solid #dbe5ef;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#eef3f8;font-family:Arial,sans-serif;color:#14283e"><div style="max-width:680px;margin:auto;background:white;border-radius:12px;overflow:hidden"><div style="padding:24px;background:#0b1a2b;color:white"><div style="color:#7fc7ff;font-weight:bold">CYBERBENCH</div><h1 style="font-size:24px;margin:12px 0 0">New website support request</h1></div><div style="padding:24px"><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table><h2 style="font-size:18px;margin-top:28px">Issue description</h2><div style="white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f7fb;padding:18px;border-radius:8px">${escapeHtml(ticket.description)}</div><p style="font-size:14px">Reply to this email to contact the requester.</p><p style="font-size:12px;color:#526477">Source: CyberBench public Submit Ticket form. Customer details are unverified.</p></div></div></body></html>`;
  // Stable content and key let a retry reuse Resend's 24-hour idempotency window.
  const digest = createHash('sha256').update(JSON.stringify(ticket)).digest('hex');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
        'Idempotency-Key': `cyberbench-web/${digest}` },
      body: JSON.stringify({ from: sender, to: [RECIPIENT], reply_to: ticket.email,
        subject: `[CyberBench][${ticket.urgency.toUpperCase()}] ${ticket.company} — website request`,
        text, html }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.id) {
      console.error('Ticket email provider rejected request.', { status: response.status });
      return reply(502, { error: 'Unable to confirm sending. Try again, or email support@cyberbench.io.' });
    }
    return reply(200, { ok: true, reference });
  } catch {
    console.error('Ticket email provider connection failed.');
    return reply(503, { error: 'Unable to confirm sending. Try again, or email support@cyberbench.io.' });
  }
}
