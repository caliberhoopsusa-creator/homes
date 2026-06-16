// A tiny, dependency-free PDF writer. Produces a single-page, single-font
// (Helvetica) PDF from an array of text lines. This avoids pulling a heavy PDF
// library into the service; swap for a richer renderer behind `renderContractPdf`
// if styled/branded contracts are needed later. Output is a valid PDF 1.4.

function escapePdfText(s: string): string {
  // Keep printable ASCII only, then escape the PDF string delimiters.
  return s
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildContentStream(lines: string[]): string {
  let s = "BT\n/F1 10 Tf\n14 TL\n50 740 Td\n";
  lines.forEach((line, i) => {
    const text = escapePdfText(line).slice(0, 120);
    s += i === 0 ? `(${text}) Tj\n` : `T* (${text}) Tj\n`;
  });
  s += "ET";
  return s;
}

function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** Render text lines to a valid single-page PDF (Uint8Array). */
export function renderContractPdf(lines: string[]): Uint8Array {
  const content = buildContentStream(lines);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  const size = objects.length + 1;
  pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return latin1Bytes(pdf);
}
