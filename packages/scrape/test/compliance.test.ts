import { describe, it, expect } from "vitest";
import {
  isDenied,
  isPermitted,
  assertPermitted,
  parseRobots,
  robotsAllows,
  DENY_DOMAINS,
} from "../src/compliance.js";

describe("denylist", () => {
  it("denies the four ToS-forbidden domains", () => {
    for (const d of DENY_DOMAINS) {
      expect(isDenied(`https://${d}/x`)).toBe(true);
      expect(isPermitted(`https://${d}/x`)).toBe(false);
    }
  });

  it("catches subdomain bypass attempts", () => {
    expect(isDenied("https://www.zillow.com/")).toBe(true);
    expect(isDenied("https://photos.zillow.com/listing/1")).toBe(true);
    expect(isPermitted("https://api.redfin.com/v1")).toBe(false);
  });

  it("does not deny look-alike domains it merely contains", () => {
    expect(isDenied("https://not-zillow.example.com/")).toBe(false);
    expect(isDenied("https://zillow.com.evil.example/")).toBe(false);
    expect(isPermitted("https://billings.county-records.example.gov/p/1")).toBe(true);
  });

  it("treats unparseable URLs as denied / not permitted", () => {
    expect(isDenied("not a url")).toBe(true);
    expect(isPermitted("not a url")).toBe(false);
  });

  it("respects an allowlist when provided (denylist still wins)", () => {
    const allow = ["county-records.example.gov"];
    expect(isPermitted("https://billings.county-records.example.gov/p", allow)).toBe(true);
    expect(isPermitted("https://fsbo.example.com/p", allow)).toBe(false);
    expect(isPermitted("https://zillow.com/p", allow)).toBe(false);
  });

  it("assertPermitted throws on denied, passes on permitted", () => {
    expect(() => assertPermitted("https://zillow.com/x")).toThrow(/not a permitted source/);
    expect(() => assertPermitted("https://county-records.example.gov/x")).not.toThrow();
  });
});

describe("robots.txt", () => {
  const robots = [
    "User-agent: *",
    "Disallow: /private",
    "Disallow: /tmp",
    "",
    "User-agent: parcelbot",
    "Disallow: /no-bots",
  ].join("\n");

  it("parses the union of * and our agent group", () => {
    const rules = parseRobots(robots, "parcelbot");
    expect(rules.disallow).toContain("/private");
    expect(rules.disallow).toContain("/no-bots");
  });

  it("allows and disallows paths by prefix", () => {
    const rules = parseRobots(robots, "parcelbot");
    expect(robotsAllows(rules, "https://x.example/private/secret")).toBe(false);
    expect(robotsAllows(rules, "https://x.example/public/ok")).toBe(true);
    expect(robotsAllows(rules, "https://x.example/no-bots")).toBe(false);
  });

  it("an empty robots file allows everything", () => {
    expect(robotsAllows(parseRobots(""), "https://x.example/anything")).toBe(true);
  });
});
