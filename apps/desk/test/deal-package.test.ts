import { describe, it, expect } from "vitest";
import { buildDealPackageLines, type DealPackageInput } from "../lib/deal-package";
import { buildBuyerDispoEmail } from "../lib/buyer-dispatch";

const base: DealPackageInput = {
  address: "44 Cooper St",
  city: "Bozeman",
  state: "MT",
  zip: "59718",
  beds: 3,
  baths: 2,
  sqft: 1650,
  yearBuilt: 1989,
  distress: ["tax_delinquent"],
  arv: 580_000,
  repairs: 20_000,
  buyerCeiling: 386_000,
  yourMao: 376_000,
  feeTarget: 10_000,
  feePotential: 14_000,
  asking: 372_000,
  verdict: "clear",
  compCount: 4,
  isEstimate: false,
};

describe("buildDealPackageLines", () => {
  it("includes the address, the engine numbers, and the comp basis", () => {
    const text = buildDealPackageLines(base).join("\n");
    expect(text).toContain("44 Cooper St");
    expect(text).toContain("$580,000"); // ARV
    expect(text).toContain("4 comparable sales"); // comp basis
    expect(text).toContain("clear");
  });

  it("labels an AVM estimate when no comps backed the ARV", () => {
    const text = buildDealPackageLines({ ...base, compCount: 0, isEstimate: true }).join("\n");
    expect(text).toContain("AVM estimate");
  });

  it("markets contract rights, never 'for sale' (MT broker line)", () => {
    const text = buildDealPackageLines(base).join("\n").toLowerCase();
    expect(text).toContain("assignable contract");
    expect(text).not.toContain("for sale");
  });

  it("adds a 'Prepared for' line when a buyer name is given", () => {
    const text = buildDealPackageLines({ ...base, buyerName: "Summit Holdings" }).join("\n");
    expect(text).toContain("Prepared for: Summit Holdings");
  });
});

describe("buildBuyerDispoEmail", () => {
  const email = buildBuyerDispoEmail({
    buyerName: "Summit Holdings",
    address: "44 Cooper St",
    city: "Bozeman",
    beds: 3,
    baths: 2,
    sqft: 1650,
    arv: 580_000,
    repairs: 20_000,
    buyerCeiling: 386_000,
    packageUrl: "https://desk.example/api/deals/d1/package",
    mailingAddress: "Parcel LLC, PO Box 1, Bozeman, MT 59718",
  });

  it("is CAN-SPAM compliant: physical address + working opt-out", () => {
    expect(email.body).toContain("Parcel LLC, PO Box 1, Bozeman, MT 59718");
    expect(email.body.toLowerCase()).toContain("reply remove");
  });

  it("links the deal package and personalizes the greeting", () => {
    expect(email.body).toContain("https://desk.example/api/deals/d1/package");
    expect(email.body).toContain("Hi Summit Holdings,");
  });

  it("uses the MT broker line and never says 'for sale'", () => {
    const lower = `${email.subject}\n${email.body}`.toLowerCase();
    expect(lower).toContain("not a real estate broker");
    expect(lower).not.toContain("for sale");
  });
});
