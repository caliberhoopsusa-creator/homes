import { describe, it, expect } from "vitest";
import { inferBuyersFromCashSales } from "../lib/buyers-import";

describe("inferBuyersFromCashSales", () => {
  it("groups a buyer's purchases into one inferred buy-box", () => {
    const buyers = inferBuyersFromCashSales([
      { buyer_name: "Acme Homes LLC", city: "Billings", state: "MT", price: 120_000, beds: 3 },
      { buyer_name: "acme homes llc", city: "Laurel", state: "MT", price: 180_000, beds: 4 },
      { buyer_name: "   ", city: "Nowhere" }, // skipped: no name
    ]);
    expect(buyers).toHaveLength(1);
    const b = buyers[0]!;
    expect(b.name).toBe("Acme Homes LLC");
    expect(b.type).toBe("cash buyer");
    expect(b.areas).toEqual(["Billings", "Laurel"]);
    expect(b.min_price).toBe(120_000);
    expect(b.max_price).toBe(180_000);
    expect(b.min_beds).toBe(3);
    expect(b.notes).toMatch(/2 county cash purchases/);
  });

  it("handles missing price/beds and falls back area to zip", () => {
    const [b] = inferBuyersFromCashSales([{ buyer_name: "Solo Investor", zip: "59101" }]);
    expect(b!.min_price).toBeNull();
    expect(b!.min_beds).toBeNull();
    expect(b!.areas).toEqual(["59101"]);
    expect(b!.notes).toMatch(/1 county cash purchase\./);
  });

  it("skips records with no usable buyer name", () => {
    expect(inferBuyersFromCashSales([{ buyer_name: "" }, { buyer_name: "  " }])).toEqual([]);
  });
});
