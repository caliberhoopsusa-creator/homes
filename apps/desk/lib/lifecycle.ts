// Contract → deal lifecycle rules. Pure + testable; the data layer applies them.
// Human gate: a contract advances one explicit step at a time, and the deal's
// stage follows the contract (never auto-sent — each step is an operator click).
import type { ContractStatus, DealStage } from "@parcel/types";

// queued → approved → sent → signed. `signed` and `void` are terminal.
const NEXT_CONTRACT: Partial<Record<ContractStatus, ContractStatus>> = {
  queued: "approved",
  approved: "sent",
  sent: "signed",
};

/** The next contract status for the human gate, or null if terminal. */
export function nextContractStatus(status: ContractStatus): ContractStatus | null {
  return NEXT_CONTRACT[status] ?? null;
}

/**
 * The deal stage a contract status implies (auto-advance). null = leave the
 * stage unchanged. A contract that's been sent means the deal is assigned to its
 * buyer; a signed contract means the deal is closed.
 */
export function dealStageForContractStatus(status: ContractStatus): DealStage | null {
  if (status === "sent") return "Assigned";
  if (status === "signed") return "Closed";
  return null;
}
