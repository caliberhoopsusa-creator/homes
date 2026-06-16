// The intake orchestrator: inbound reply -> classify intent -> write `replies`
// -> GATE. Only a positive ("interested") intent generates a contract, and even
// then the contract is QUEUED, never sent (PRD §6.5, §8.1 — no cold contracts;
// a human approves in the desk). Opt-outs suppress the owner and never create a
// contract. Talks to the rest of the system only through Postgres via the
// injected `IntakeStore` (§7.4).
import type {
  ContractInsert,
  DealInsert,
  ReplyInsert,
  ReplyIntent,
  SuppressionReason,
} from "@parcel/types";
import type { IntentClassifier } from "./classifier.js";
import type { ContractStorage } from "./storage.js";
import { renderContractPdf } from "./pdf.js";
import { fillAssignmentTemplate } from "./template.js";
import type { InboundEmail } from "./inbound.js";

/** Everything the orchestrator needs to resolve and persist. */
export interface OwnerContext {
  ownerId: string | null;
  messageId: string | null;
  propertyId: string | null;
  ownerName: string | null;
  propertyAddress: string | null;
  /** Offer price for the contract = the underwrite's your_mao. */
  yourMao: number | null;
}

export interface IntakeStore {
  /** Resolve the owner/message/underwrite context for an inbound email. */
  resolveContext(input: {
    fromEmail: string;
    inReplyTo: string | null;
  }): Promise<OwnerContext>;
  insertReply(row: ReplyInsert): Promise<{ id: string }>;
  /** True if an inbound with this provider message id was already processed (idempotency). */
  alreadyHandled(providerMessageId: string): Promise<boolean>;
  /** Mark the outbound message that was replied to (best-effort). */
  markMessageReplied(messageId: string): Promise<void>;
  insertContract(row: ContractInsert): Promise<{ id: string }>;
  insertDeal(row: DealInsert): Promise<{ id: string }>;
  /** Permanent suppression — honored by outreach before any send. */
  addSuppression(email: string, reason: SuppressionReason): Promise<void>;
}

export interface IntakeDeps {
  store: IntakeStore;
  classifier: IntentClassifier;
  storage: ContractStorage;
  /** Our buying entity, named on the contract as Buyer. */
  buyerName?: string;
}

export interface IntakeResult {
  intent: ReplyIntent;
  confidence: number;
  replyId: string;
  contractId: string | null;
  dealId: string | null;
  suppressed: boolean;
  /** True when this inbound was a duplicate (webhook retry) and was skipped. */
  duplicate?: boolean;
  /** Why no contract was produced for an "interested" reply, if applicable. */
  note?: string;
}

/**
 * Handle one inbound reply end-to-end. Designed to complete well under the 60s
 * SLA (PRD §3): one classify call + one PDF render + a few row writes.
 */
export async function handleInboundReply(
  email: InboundEmail,
  deps: IntakeDeps,
): Promise<IntakeResult> {
  const { store, classifier, storage } = deps;

  // Idempotency: a re-delivered webhook must not create a second contract/deal.
  if (email.messageId && (await store.alreadyHandled(email.messageId))) {
    return {
      intent: "unknown",
      confidence: 0,
      replyId: "",
      contractId: null,
      dealId: null,
      suppressed: false,
      duplicate: true,
      note: "duplicate inbound (already handled)",
    };
  }

  const ctx = await store.resolveContext({
    fromEmail: email.fromEmail,
    inReplyTo: email.inReplyTo,
  });

  const { intent, confidence } = await classifier.classify(email.text);

  const reply = await store.insertReply({
    message_id: ctx.messageId,
    owner_id: ctx.ownerId,
    provider_id: email.messageId,
    raw_text: email.text,
    intent,
    intent_confidence: confidence,
  });

  if (ctx.messageId) {
    await store.markMessageReplied(ctx.messageId);
  }

  const result: IntakeResult = {
    intent,
    confidence,
    replyId: reply.id,
    contractId: null,
    dealId: null,
    suppressed: false,
  };

  // ── GATE ──────────────────────────────────────────────────────────────────
  if (intent === "do_not_contact") {
    if (email.fromEmail) await store.addSuppression(email.fromEmail, "do_not_contact");
    result.suppressed = true;
    return result;
  }

  if (intent !== "interested") {
    // maybe / not_now / unknown: record the reply, take no irreversible action.
    return result;
  }

  // Positive intent → generate a QUEUED contract + a desk deal at "Contacted".
  if (ctx.yourMao == null || !ctx.propertyAddress) {
    // Surface the warm lead even if we can't price it yet; no contract.
    if (ctx.propertyId) {
      const deal = await store.insertDeal({
        property_id: ctx.propertyId,
        stage: "Contacted",
        notes: "Positive reply; contract pending underwrite/offer price.",
      });
      result.dealId = deal.id;
    }
    result.note = "interested but missing underwrite (your_mao) or address; contract not generated";
    return result;
  }

  const lines = fillAssignmentTemplate({
    sellerName: ctx.ownerName ?? "Property Owner",
    buyerName: deps.buyerName ?? "Parcel Holdings LLC",
    propertyAddress: ctx.propertyAddress,
    offerPrice: ctx.yourMao,
  });
  const pdf = renderContractPdf(lines);
  const path = `${ctx.propertyId ?? "unknown"}/${reply.id}.pdf`;
  const { url } = await storage.upload(path, pdf, "application/pdf");

  const contract = await store.insertContract({
    property_id: ctx.propertyId,
    owner_id: ctx.ownerId,
    offer_price: ctx.yourMao,
    pdf_url: url,
    status: "queued", // NEVER auto-sent — human approves in the desk.
  });
  result.contractId = contract.id;

  const deal = await store.insertDeal({
    property_id: ctx.propertyId,
    stage: "Contacted",
    notes: "Positive reply; contract queued for review.",
  });
  result.dealId = deal.id;

  return result;
}
