// Real-shape BatchData integration (the chosen default real provider). Uses
// global `fetch` and reads the key from env — never from source (§7.4). It maps
// BatchData's property-search response into PropertyCandidate[]. Not exercised
// live in tests; it is a faithful, typed integration. Throws if the key is unset.
import type { RadiusPullRequest, PropertyCandidate } from "@parcel/types";
import type { PropertyProvider } from "../provider.js";
import { normalizeDistress } from "../normalize.js";

const BATCHDATA_URL = "https://api.batchdata.com/api/v1/property/search";

// The subset of BatchData's response we consume. Their payload is large; we map
// only the fields that populate a candidate.
interface BatchAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
}
interface BatchBuilding {
  bedroomCount?: number;
  bathroomCount?: number;
  totalBuildingAreaSquareFeet?: number;
  yearBuilt?: number;
}
interface BatchValuation {
  estimatedValue?: number;
}
interface BatchQuickList {
  taxDelinquent?: boolean;
  preforeclosure?: boolean;
  vacant?: boolean;
  absenteeOwner?: boolean;
}
interface BatchProperty {
  _id?: string;
  id?: string;
  address?: BatchAddress;
  building?: BatchBuilding;
  valuation?: BatchValuation;
  quickLists?: BatchQuickList;
}
interface BatchResponse {
  results?: { properties?: BatchProperty[] };
}

export class BatchDataProvider implements PropertyProvider {
  private readonly apiKey: string;

  constructor(apiKey = process.env.BATCHDATA_API_KEY) {
    if (!apiKey) {
      throw new Error(
        "BatchDataProvider: BATCHDATA_API_KEY is not set. " +
          "Set it in the environment or use PROPERTY_PROVIDER=mock.",
      );
    }
    this.apiKey = apiKey;
  }

  async search(req: RadiusPullRequest): Promise<PropertyCandidate[]> {
    const body = {
      searchCriteria: {
        geoLocation: {
          latitude: req.lat,
          longitude: req.lng,
          radiusMiles: req.radiusMiles,
        },
        // Translate our filters onto BatchData's quick-list flags.
        ...(req.filters.minBeds !== undefined
          ? { building: { bedroomCount: { min: req.filters.minBeds } } }
          : {}),
        ...(req.filters.distress?.length
          ? { quickLists: distressToQuickLists(req.filters.distress) }
          : {}),
      },
    };

    const res = await fetch(BATCHDATA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(
        `BatchDataProvider: ${res.status} ${res.statusText} from BatchData`,
      );
    }

    const json = (await res.json()) as BatchResponse;
    const properties = json.results?.properties ?? [];
    return properties.map((p) => mapProperty(p));
  }
}

function distressToQuickLists(
  signals: ReadonlyArray<string>,
): Record<string, boolean> {
  const map: Record<string, string> = {
    tax_delinquent: "taxDelinquent",
    preforeclosure: "preforeclosure",
    vacant: "vacant",
    absentee: "absenteeOwner",
  };
  const out: Record<string, boolean> = {};
  for (const s of signals) {
    const key = map[s];
    if (key) out[key] = true;
  }
  return out;
}

function mapProperty(p: BatchProperty): PropertyCandidate {
  const a = p.address ?? {};
  const b = p.building ?? {};
  const tags: string[] = [];
  if (p.quickLists?.taxDelinquent) tags.push("tax_delinquent");
  if (p.quickLists?.preforeclosure) tags.push("preforeclosure");
  if (p.quickLists?.vacant) tags.push("vacant");
  if (p.quickLists?.absenteeOwner) tags.push("absentee");

  return {
    source: "batchdata",
    source_id: p._id ?? p.id ?? null,
    address: a.street ?? "",
    city: a.city ?? null,
    state: a.state ?? null,
    zip: a.zip ?? null,
    lat: a.latitude ?? null,
    lng: a.longitude ?? null,
    beds: b.bedroomCount ?? null,
    baths: b.bathroomCount ?? null,
    sqft: b.totalBuildingAreaSquareFeet ?? null,
    year_built: b.yearBuilt ?? null,
    est_value: p.valuation?.estimatedValue ?? null,
    asking: null,
    distress_signals: normalizeDistress(tags),
  };
}
