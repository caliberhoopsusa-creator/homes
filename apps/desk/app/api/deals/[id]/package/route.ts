// Render a deal's buyer-facing deal package (Max's CMA package) on demand. Pulls
// the deal + property + underwrite, re-runs the canonical underwrite() so the
// numbers match the desk exactly, and renders via the intake PDF writer.
// MT framing: markets an assignable contract, not the property for sale.
import { underwrite } from "@parcel/underwriting";
import { renderContractPdf } from "@parcel/intake";
import { getDeal, getProperty, getUnderwriteForProperty } from "@/lib/data";
import { buildDealPackageLines } from "@/lib/deal-package";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal?.property_id) return new Response("Deal not found", { status: 404 });

  const property = await getProperty(deal.property_id);
  if (!property) return new Response("Property not found", { status: 404 });
  const uw = await getUnderwriteForProperty(property.id);

  const live = underwrite({
    arv: uw?.arv ?? property.est_value ?? 0,
    repairs: uw?.repairs ?? 0,
    asking: property.asking ?? 0,
    rulePct: uw?.rule_pct,
    feeTarget: uw?.fee_target,
  });

  const lines = buildDealPackageLines({
    address: property.address,
    city: property.city,
    state: property.state,
    zip: property.zip,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    yearBuilt: property.year_built,
    distress: property.distress_signals ?? [],
    arv: live.arv,
    repairs: live.repairs,
    buyerCeiling: live.buyerCeiling,
    yourMao: live.yourMao,
    feeTarget: live.feeTarget,
    feePotential: live.feePotential,
    asking: live.asking,
    verdict: live.verdict,
    compCount: uw?.comp_count ?? 0,
    isEstimate: uw?.is_estimate ?? true,
  });

  const pdf = renderContractPdf(lines);
  return new Response(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="deal-package-${id}.pdf"`,
    },
  });
}
