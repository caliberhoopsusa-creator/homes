// Normalize a SendGrid Inbound Parse webhook payload into the shape the intake
// orchestrator consumes. Inbound Parse POSTs multipart form fields; the caller
// (an edge function / route handler) turns that into a flat record and passes it
// here. Parsing is pure and dependency-free so it is fully testable.

export interface InboundEmail {
  /** Bare sender email, lowercased. */
  fromEmail: string;
  /** Bare recipient email (our reply-to / monitored inbox), lowercased. */
  toEmail: string;
  subject: string;
  /** Plain-text body (we prefer text over html for classification). */
  text: string;
  /** The provider message id this is a reply to (from In-Reply-To), if present. */
  inReplyTo: string | null;
}

/** Extract the first bare email address from a header value like `Name <a@b.com>`. */
export function extractEmail(value: string | undefined | null): string {
  if (!value) return "";
  const angle = value.match(/<([^>]+)>/);
  const candidate = (angle && angle[1]) || value;
  const m = candidate.match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);
  return (m?.[0] ?? "").trim().toLowerCase();
}

/** Pull `In-Reply-To` (a Message-ID) out of the raw headers blob. */
export function parseInReplyTo(headers: string | undefined | null): string | null {
  if (!headers) return null;
  const m = headers.match(/^In-Reply-To:\s*(.+)$/im);
  if (!m || !m[1]) return null;
  const id = m[1].trim().replace(/^<|>$/g, "");
  return id || null;
}

/** SendGrid Inbound Parse fields → InboundEmail. */
export function parseInboundParse(
  fields: Record<string, string | undefined>,
): InboundEmail {
  return {
    fromEmail: extractEmail(fields.from),
    toEmail: extractEmail(fields.to),
    subject: (fields.subject ?? "").trim(),
    text: (fields.text ?? fields.html ?? "").trim(),
    inReplyTo: parseInReplyTo(fields.headers),
  };
}
