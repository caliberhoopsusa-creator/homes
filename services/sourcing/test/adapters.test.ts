import { describe, it, expect } from "vitest";
import { csvToCountyRecords, parseCsv } from "../src/adapters/csv.js";

const csv = `Parcel,Owner Address,Town,ST,Zip,Beds,Assessed
R-1,"1420 Beckwith Ave, Apt 2",Missoula,MT,59801,3,"$365,000"
R-2,78 Strand Ave,Missoula,MT,59801,,
,,,,,,
R-4,311 Wylie Ave,Bozeman,MT,59715,5,610000`;

describe("parseCsv", () => {
  it("handles quoted fields with commas and drops blank rows", () => {
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3); // R-1, R-2, R-4 (blank row dropped)
    expect(rows[0]!["Owner Address"]).toBe("1420 Beckwith Ave, Apt 2");
  });
});

describe("csvToCountyRecords", () => {
  const map = {
    address: "Owner Address",
    record_id: "Parcel",
    city: "Town",
    state: "ST",
    zip: "Zip",
    beds: "Beds",
    est_value: "Assessed",
  };

  it("maps columns, coerces numerics, and drops address-less rows", () => {
    const recs = csvToCountyRecords(csv, map);
    expect(recs).toHaveLength(3);

    expect(recs[0]!.address).toBe("1420 Beckwith Ave, Apt 2");
    expect(recs[0]!.record_id).toBe("R-1");
    expect(recs[0]!.city).toBe("Missoula");
    expect(recs[0]!.state).toBe("MT");
    expect(recs[0]!.beds).toBe(3);
    expect(recs[0]!.est_value).toBe(365000); // "$365,000" → 365000

    expect(recs[1]!.beds).toBeNull(); // empty cell
    expect(recs[2]!.est_value).toBe(610000);
  });

  it("returns [] when no row has an address", () => {
    expect(csvToCountyRecords("A,B\n1,2", { address: "Missing" })).toEqual([]);
  });
});
