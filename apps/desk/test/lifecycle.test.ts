import { describe, it, expect } from "vitest";
import {
  nextContractStatus,
  dealStageForContractStatus,
} from "../lib/lifecycle";

describe("nextContractStatus", () => {
  it("advances one step: queued → approved → sent → signed", () => {
    expect(nextContractStatus("queued")).toBe("approved");
    expect(nextContractStatus("approved")).toBe("sent");
    expect(nextContractStatus("sent")).toBe("signed");
  });
  it("is null at terminal states", () => {
    expect(nextContractStatus("signed")).toBeNull();
    expect(nextContractStatus("void")).toBeNull();
  });
});

describe("dealStageForContractStatus", () => {
  it("sent → Assigned, signed → Closed, else no change", () => {
    expect(dealStageForContractStatus("sent")).toBe("Assigned");
    expect(dealStageForContractStatus("signed")).toBe("Closed");
    expect(dealStageForContractStatus("queued")).toBeNull();
    expect(dealStageForContractStatus("approved")).toBeNull();
  });
});
