import { describe, it, expect } from "vitest";
import { extractLinks, sameHost, nextFrontier } from "../src/crawl.js";

const HTML = `
  <a href="/parcels/1">one</a>
  <a href="https://county.example.gov/parcels/2">two</a>
  <a href="https://other.example.com/x">offsite</a>
  <a href="https://zillow.com/listing">denied</a>
  <a href="#frag">frag-only</a>
  <a href="mailto:x@y.com">mail</a>
`;
const SEED = "https://county.example.gov/parcels/";

describe("extractLinks", () => {
  it("resolves relative links and keeps only http(s)", () => {
    const links = extractLinks(HTML, SEED);
    expect(links).toContain("https://county.example.gov/parcels/1");
    expect(links).toContain("https://county.example.gov/parcels/2");
    expect(links).not.toContain("mailto:x@y.com");
    expect(links.some((l) => l.includes("#"))).toBe(false);
  });
});

describe("sameHost", () => {
  it("ignores www and compares hostnames", () => {
    expect(sameHost("https://www.county.example.gov/a", "https://county.example.gov/b")).toBe(true);
    expect(sameHost("https://other.example.com/a", SEED)).toBe(false);
  });
});

describe("nextFrontier", () => {
  it("keeps same-host permitted unseen links, drops offsite/denied/seen", () => {
    const seen = new Set(["https://county.example.gov/parcels/1"]);
    const out = nextFrontier(extractLinks(HTML, SEED), SEED, seen);
    expect(out).toEqual(["https://county.example.gov/parcels/2"]);
  });
});
