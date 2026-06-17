import { describe, it, expect } from "vitest";
import {
  inferBuyersFromCashSales,
  inferBuyersFromOwnership,
} from "../lib/buyers-import";

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

describe("inferBuyersFromOwnership", () => {
  const parcels = [
    { owner_name: "Sapphire Capital LLC", owner_city: "Denver", owner_state: "CO", property_city: "Billings", value: 240000 },
    { owner_name: "sapphire capital llc", owner_city: "Denver", owner_state: "CO", property_city: "Laurel", value: 310000 },
    { owner_name: "Sapphire Capital LLC", owner_city: "Denver", owner_state: "CO", property_city: "Billings", value: 180000 },
    { owner_name: "Jane Homeowner", owner_state: "MT", property_city: "Billings", value: 290000 }, // only 1 → skipped
    { owner_name: "City of Billings", property_city: "Billings", value: 5000000 }, // govt → skipped
    { owner_name: "City of Billings", property_city: "Billings", value: 5000000 },
  ];

  it("turns multi-property owners into investor buy-boxes (≥2 parcels), excluding govt/banks", () => {
    const buyers = inferBuyersFromOwnership(parcels);
    expect(buyers).toHaveLength(1); // only Sapphire (3 parcels); Jane (1) + City (govt) excluded
    const b = buyers[0]!;
    expect(b.name).toBe("Sapphire Capital LLC");
    expect(b.type).toBe("investor");
    expect(b.areas).toEqual(["Billings", "Laurel"]);
    expect(b.min_price).toBe(180000);
    expect(b.max_price).toBe(310000);
    expect(b.notes).toMatch(/Owns 3 properties in Billings, Laurel; mailing Denver, CO\./);
  });

  it("honors a custom minProperties threshold", () => {
    expect(inferBuyersFromOwnership(parcels, { minProperties: 4 })).toEqual([]); // nobody owns 4
  });
});
