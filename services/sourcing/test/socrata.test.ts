import { describe, it, expect } from "vitest";
import {
  socrataToCountyRecords,
  socrataQueryUrl,
} from "../src/adapters/socrata.js";

const map = {
  record_id: "violation_id",
  address: "address",
  city: "city",
  state: "state",
  zip: "zip",
  est_value: "assessed_value",
};

describe("socrataToCountyRecords", () => {
  it("maps Socrata records to CountyRecord and drops address-less rows", () => {
    const json = [
      {
        violation_id: "V-1",
        address: "742 N 29th St",
        city: "Billings",
        state: "MT",
        zip: "59101",
        assessed_value: "228000",
      },
      { violation_id: "V-2", address: "", city: "Billings" }, // no address → dropped
    ];
    const recs = socrataToCountyRecords(json, map);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      record_id: "V-1",
      address: "742 N 29th St",
      city: "Billings",
      state: "MT",
      zip: "59101",
      est_value: 228000,
    });
  });

  it("unwraps a Socrata human_address object in the address field", () => {
    const json = [
      {
        address: { address: "118 Wyoming Ave", city: "Billings", zip: "59101" },
      },
    ];
    expect(socrataToCountyRecords(json, { address: "address" })[0]?.address).toBe(
      "118 Wyoming Ave",
    );
  });

  it("handles non-array / empty input", () => {
    expect(socrataToCountyRecords(null, map)).toEqual([]);
    expect(socrataToCountyRecords({}, map)).toEqual([]);
    expect(socrataToCountyRecords([], map)).toEqual([]);
  });
});

describe("socrataQueryUrl", () => {
  it("builds a SODA resource url with SoQL params + explicit limit", () => {
    const u = socrataQueryUrl("data.cityofchicago.org", "22u3-xenr", {
      where: "violation_status='OPEN'",
      select: "address,violation_status",
      order: "violation_date DESC",
      limit: 500,
    });
    expect(u).toContain("https://data.cityofchicago.org/resource/22u3-xenr.json?");
    expect(u).toContain("%24limit=500");
    const decoded = decodeURIComponent(u);
    expect(decoded).toContain("$where=violation_status='OPEN'");
    expect(decoded).toContain("$select=address,violation_status");
  });

  it("normalizes a domain given with scheme/trailing slash and defaults the limit", () => {
    const u = socrataQueryUrl("https://data.example.gov/", "abcd-1234");
    expect(u).toBe(
      "https://data.example.gov/resource/abcd-1234.json?%24limit=1000",
    );
  });
});
