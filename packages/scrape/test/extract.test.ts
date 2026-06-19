import { describe, it, expect } from "vitest";
import { MockExtractor, createExtractor } from "../src/extract.js";
import type { ExtractSchema } from "../src/engine.js";

const PROPERTY_SCHEMA: ExtractSchema = {
  type: "object",
  properties: {
    zip: { type: "string" },
    beds: { type: "number" },
    baths: { type: "number" },
    sqft: { type: "number" },
    year_built: { type: "number" },
    est_value: { type: "number" },
    asking: { type: "number" },
  },
};

const OWNER_SCHEMA: ExtractSchema = {
  type: "object",
  properties: {
    email: { type: "string" },
    phone: { type: "string" },
  },
};

describe("MockExtractor", () => {
  const text =
    "123 Mock St 59101. 3 bed 2 bath 1,450 sqft built 1978. " +
    "Estimated value $245,000. Asking price $190,000. " +
    "Contact jane.owner@example.com (406) 555-0142.";

  it("coerces numbers and strips separators", async () => {
    const out = await new MockExtractor().extract(text, PROPERTY_SCHEMA);
    expect(out).toMatchObject({
      zip: "59101",
      beds: 3,
      baths: 2,
      sqft: 1450,
      year_built: 1978,
      est_value: 245000,
      asking: 190000,
    });
  });

  it("pulls owner contact fields", async () => {
    const out = await new MockExtractor().extract(text, OWNER_SCHEMA);
    expect(out.email).toBe("jane.owner@example.com");
    expect(String(out.phone)).toMatch(/555.?0142/);
  });

  it("omits fields it cannot find", async () => {
    const out = await new MockExtractor().extract("nothing useful here", PROPERTY_SCHEMA);
    expect(Object.keys(out)).toHaveLength(0);
  });
});

describe("createExtractor", () => {
  it("defaults to the mock and rejects unknown names", () => {
    expect(createExtractor("mock")).toBeInstanceOf(MockExtractor);
    expect(() => createExtractor("bogus")).toThrow(/Unknown SCRAPE_EXTRACTOR/);
  });
});
