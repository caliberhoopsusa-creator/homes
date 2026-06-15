// Real-shape BatchData skip-trace integration. Uses global `fetch` and reads the
// key from env — never from source (§7.4). Maps BatchData's skip-trace response
// into an OwnerHit (or null when unmatched). Not exercised live in tests; it is a
// faithful, typed integration. Throws if the key is unset.
import type { Property, OwnerHit } from "@parcel/types";
import type { SkipTraceProvider } from "../provider.js";

const BATCHDATA_URL = "https://api.batchdata.com/api/v1/property/skip-trace";

// The subset of BatchData's skip-trace response we consume.
interface BatchPhone {
  number?: string;
  type?: string;
}
interface BatchEmail {
  email?: string;
}
interface BatchName {
  full?: string;
  first?: string;
  last?: string;
}
interface BatchPersonAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}
interface BatchPerson {
  name?: BatchName;
  emails?: BatchEmail[];
  phoneNumbers?: BatchPhone[];
  mailingAddress?: BatchPersonAddress;
  /** BatchData returns a 0–100 match score. */
  matchScore?: number;
}
interface BatchResponse {
  results?: { persons?: BatchPerson[] };
}

export class BatchDataProvider implements SkipTraceProvider {
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

  async trace(property: Property): Promise<OwnerHit | null> {
    const body = {
      requests: [
        {
          propertyAddress: {
            street: property.address,
            city: property.city ?? undefined,
            state: property.state ?? undefined,
            zip: property.zip ?? undefined,
          },
        },
      ],
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
    const person = json.results?.persons?.[0];
    if (!person) return null;

    return mapPerson(person, property);
  }
}

function mapPerson(p: BatchPerson, property: Property): OwnerHit {
  const composed = [p.name?.first, p.name?.last].filter(Boolean).join(" ");
  const full_name = p.name?.full ?? (composed.length > 0 ? composed : null);
  const email = p.emails?.find((e) => e.email)?.email ?? null;
  const phone = p.phoneNumbers?.find((n) => n.number)?.number ?? null;

  const addr = p.mailingAddress;
  const mailing_address = addr
    ? [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(", ")
    : property.address;

  // Normalize BatchData's 0–100 score into the 0–1 confidence the schema wants.
  const raw = p.matchScore ?? 0;
  const confidence = Math.max(0, Math.min(1, raw / 100));

  return { full_name, email, phone, mailing_address, confidence };
}
