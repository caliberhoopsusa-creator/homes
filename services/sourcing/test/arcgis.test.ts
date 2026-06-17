import { describe, it, expect } from "vitest";
import { arcgisToCountyRecords, arcgisQueryUrl } from "../src/adapters/arcgis.js";

const resp = {
  features: [
    {
      attributes: {
        PARCELID: "03-1234",
        OwnerName: "DOE JOHN",
        OwnerCity: "SEATTLE",
        OwnerState: "WA",
        TotalValue: 312000,
        PropStreetAddress: "742 N 29th St",
        PropCity: "Billings",
        PropZipCode: "59101",
      },
    },
    { attributes: { PARCELID: "03-9999", PropStreetAddress: "", TotalValue: 100 } }, // no address → dropped
  ],
};

const map = {
  record_id: "PARCELID",
  address: "PropStreetAddress",
  city: "PropCity",
  zip: "PropZipCode",
  est_value: "TotalValue",
};

describe("arcgisToCountyRecords", () => {
  it("maps ArcGIS attributes to CountyRecord and drops address-less rows", () => {
    const recs = arcgisToCountyRecords(resp, map);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      record_id: "03-1234",
      address: "742 N 29th St",
      city: "Billings",
      zip: "59101",
      est_value: 312000,
    });
  });

  it("handles empty / missing features", () => {
    expect(arcgisToCountyRecords({}, map)).toEqual([]);
    expect(arcgisToCountyRecords({ features: [] }, map)).toEqual([]);
  });
});

describe("arcgisQueryUrl", () => {
  it("builds a JSON, geometry-free query url", () => {
    const u = arcgisQueryUrl("https://x/MapServer/0", {
      where: "PropCity = 'BILLINGS'",
      outFields: "PARCELID",
      resultRecordCount: 3,
    });
    expect(u).toContain("/MapServer/0/query?");
    expect(u).toContain("f=json");
    expect(u).toContain("returnGeometry=false");
    expect(u).toContain("resultRecordCount=3");
    // URLSearchParams encodes spaces as "+"; normalize before decoding.
    expect(decodeURIComponent(u.replace(/\+/g, " "))).toContain(
      "where=PropCity = 'BILLINGS'",
    );
  });
});
