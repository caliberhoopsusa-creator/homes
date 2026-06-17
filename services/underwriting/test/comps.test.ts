import { describe, it, expect } from "vitest";
import {
  selectComps,
  estimateArvFromComps,
  haversineMiles,
  DEFAULT_COMP_CRITERIA,
  type SoldComp,
  type CompSubject,
} from "../src/comps.js";

const NOW = new Date("2026-06-17T00:00:00Z");

// Subject ~ central Missoula.
const subject: CompSubject = {
  lat: 46.87,
  lng: -113.99,
  sqft: 1500,
  beds: 3,
  garage: 1,
};

const recent = (daysAgo: number): string =>
  new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

function comp(over: Partial<SoldComp> & Pick<SoldComp, "id">): SoldComp {
  return {
    lat: 46.871,
    lng: -113.991,
    sqft: 1500,
    beds: 3,
    garage: 1,
    salePrice: 200_000,
    soldDate: recent(30),
    ...over,
  };
}

describe("haversineMiles", () => {
  it("is ~0 for identical points", () => {
    expect(haversineMiles(46.87, -113.99, 46.87, -113.99)).toBeCloseTo(0, 5);
  });

  it("returns Infinity when a coordinate is missing", () => {
    expect(haversineMiles(null, -113.99, 46.87, -113.99)).toBe(Infinity);
  });
});

describe("selectComps", () => {
  it("keeps a tight, recent, similar comp", () => {
    const out = selectComps(subject, [comp({ id: "a" })], DEFAULT_COMP_CRITERIA, NOW);
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });

  it("rejects comps beyond the distance radius", () => {
    const far = comp({ id: "far", lat: 45.0, lng: -111.0 }); // ~150mi away
    expect(selectComps(subject, [far], DEFAULT_COMP_CRITERIA, NOW)).toHaveLength(0);
  });

  it("rejects stale sales", () => {
    const old = comp({ id: "old", soldDate: recent(400) });
    expect(selectComps(subject, [old], DEFAULT_COMP_CRITERIA, NOW)).toHaveLength(0);
  });

  it("rejects comps outside the sqft tolerance (>±20%)", () => {
    const big = comp({ id: "big", sqft: 2000 }); // +33%
    expect(selectComps(subject, [big], DEFAULT_COMP_CRITERIA, NOW)).toHaveLength(0);
  });

  it("rejects comps outside the bedroom tolerance", () => {
    const manyBeds = comp({ id: "beds", beds: 6 });
    expect(selectComps(subject, [manyBeds], DEFAULT_COMP_CRITERIA, NOW)).toHaveLength(0);
  });

  it("caps results at maxComps, closest first", () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      comp({ id: `c${i}`, lat: 46.87 + i * 0.001 }),
    );
    const out = selectComps(subject, candidates, DEFAULT_COMP_CRITERIA, NOW);
    expect(out).toHaveLength(DEFAULT_COMP_CRITERIA.maxComps);
    expect(out[0]?.id).toBe("c0"); // nearest to subject lat
  });

  it("returns nothing when subject has no sqft", () => {
    expect(selectComps({ ...subject, sqft: null }, [comp({ id: "a" })], DEFAULT_COMP_CRITERIA, NOW))
      .toHaveLength(0);
  });
});

describe("estimateArvFromComps", () => {
  it("returns compCount 0 with no comps", () => {
    const r = estimateArvFromComps(subject, []);
    expect(r).toEqual({ arv: 0, compCount: 0, adjusted: [] });
  });

  it("an identical comp contributes its own sale price (no adjustment)", () => {
    const r = estimateArvFromComps(subject, [comp({ id: "a", salePrice: 200_000 })]);
    expect(r.arv).toBe(200_000);
    expect(r.compCount).toBe(1);
  });

  it("adjusts a comp down for features it has over the subject (Max's example)", () => {
    // Comp has +1 bed (+10k), +200 sqft (+12k @ $60), +1 garage (+7k) vs subject.
    // Subject - comp deltas are negative -> adjusted = 200k -10k -12k -7k = 171k.
    const c = comp({ id: "x", beds: 4, sqft: 1700, garage: 2, salePrice: 200_000 });
    const r = estimateArvFromComps(subject, [c]);
    expect(r.arv).toBe(171_000);
    expect(r.adjusted[0]).toEqual({ id: "x", adjustedValue: 171_000 });
  });

  it("averages adjusted values across comps", () => {
    const a = comp({ id: "a", salePrice: 190_000 });
    const b = comp({ id: "b", salePrice: 210_000 });
    const r = estimateArvFromComps(subject, [a, b]);
    expect(r.arv).toBe(200_000);
    expect(r.compCount).toBe(2);
  });
});
