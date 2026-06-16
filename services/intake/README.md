# services/intake

**Contract:** inbound reply (SendGrid Inbound Parse) → `replies` row → **gated**
contract. Talks to the rest of the system only through Postgres via `IntakeStore`.

- `parseInboundParse(fields)` — normalize the webhook payload → `InboundEmail`.
- `makeClassifier()` — `IntentClassifier`: `MockClassifier` (default, keyword) or
  `AnthropicClassifier` (`CLASSIFIER=anthropic`). → `{intent, confidence}`.
- `handleInboundReply(email, deps)` — writes the reply, then GATES:
  - `interested` → render the assignment PDF (offer price = `your_mao`), upload via
    `ContractStorage`, insert a `contracts` row **`status='queued'` (never sent)** +
    a `deals` row at `Contacted`.
  - `do_not_contact` → permanent `suppressions` row, **no contract**.
  - `maybe`/`not_now`/`unknown` → reply recorded only.

**Hard gate:** the template carries an attorney-review notice until
`CONTRACT_TEMPLATE_REVIEWED=true` (PRD §8.3). Contracts are approved/sent by a human
in the desk — this service never sends.
