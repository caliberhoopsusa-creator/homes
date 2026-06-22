// Plain-English definitions for the jargon a beginner hits in the desk. One
// source of truth so every explanation reads the same. Keep these short and
// concrete — written for someone on their first deal.
export interface GlossaryEntry {
  /** The short label shown inline. */
  term: string;
  /** Plain definition (one or two sentences, no jargon-in-the-jargon). */
  plain: string;
}

export const GLOSSARY = {
  mao: {
    term: "MAO",
    plain:
      "Maximum Allowable Offer — the most you should pay so there's still room for your fee and your buyer's profit.",
  },
  assignment_fee: {
    term: "assignment fee",
    plain:
      "Your pay. The gap between the price you put a house under contract for and what your cash buyer pays you for that contract.",
  },
  skiptrace: {
    term: "skip-trace",
    plain:
      "Looking up the owner's phone and email from public records so you can reach them.",
  },
  verdict: {
    term: "verdict",
    plain:
      "Parcel's quick call on a deal: ‘Worth working’, ‘Marginal’, or ‘Skip’ — based on the numbers.",
  },
  spread: {
    term: "spread",
    plain:
      "The profit gap on a deal — what's left between your contract price and the buyer's price after costs.",
  },
  arv: {
    term: "ARV",
    plain:
      "After-Repair Value — what the house is worth fixed up, based on nearby sales. The starting point for the offer math.",
  },
  distress_signal: {
    term: "distress signal",
    plain:
      "A public sign the owner may want to sell fast — like back taxes, a code violation, or probate. More signals = more motivated.",
  },
  motivation_score: {
    term: "motivation score",
    plain:
      "0–100 rating of how motivated a seller likely is, from their distress signals and the deal's spread. Work the hottest first.",
  },
  under_contract: {
    term: "under contract",
    plain:
      "The seller agreed to your price in writing. Now you find a buyer to take over (assign) that contract.",
  },
  dispo: {
    term: "disposition",
    plain:
      "Selling your contract to a cash buyer — the back half of the deal where you collect your fee.",
  },
  suppression: {
    term: "suppression list",
    plain:
      "People who opted out. They're permanently never contacted again — the law (CAN-SPAM) requires it.",
  },
  buy_box: {
    term: "buy box",
    plain:
      "What a buyer wants: the areas, price range, and property types they'll buy. Deals only go to buyers whose box fits.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
