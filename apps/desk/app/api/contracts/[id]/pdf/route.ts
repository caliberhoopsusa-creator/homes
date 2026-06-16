// Render a contract's assignment-agreement PDF on demand (no storage needed —
// regenerated from the contract + property + owner + buyer). Reuses the intake
// service's renderer + template, which stamps DRAFT until CONTRACT_TEMPLATE_REVIEWED
// (the Montana attorney-review gate). Node runtime (binary response).
import { fillAssignmentTemplate, renderContractPdf } from "@parcel/intake";
import {
  getBuyers,
  getContract,
  getOwnerForProperty,
  getProperty,
} from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return new Response("Contract not found", { status: 404 });

  const property = contract.property_id ? await getProperty(contract.property_id) : null;
  const [owner, buyers] = await Promise.all([
    contract.property_id ? getOwnerForProperty(contract.property_id) : Promise.resolve(null),
    getBuyers(),
  ]);
  const buyer = contract.buyer_id ? buyers.find((b) => b.id === contract.buyer_id) ?? null : null;

  const lines = fillAssignmentTemplate({
    sellerName: owner?.full_name ?? "Property Owner",
    buyerName: process.env.BUYER_ENTITY ?? "Parcel Holdings LLC",
    propertyAddress: property?.address ?? "—",
    offerPrice: contract.offer_price ?? 0,
  });
  if (buyer?.name) {
    lines.push("", `Intended assignee (end buyer): ${buyer.name}.`);
  }

  const pdf = renderContractPdf(lines);
  return new Response(pdf as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="contract-${id}.pdf"`,
    },
  });
}
