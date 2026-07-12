export interface InvoicePdfData {
  invoice: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  business?: Record<string, unknown>;
  client?: Record<string, unknown>;
}

export function renderInvoiceHtml(data: InvoicePdfData): string {
  const invoiceNumber = String(data.invoice.invoice_number ?? data.invoice.id ?? 'draft');
  const rows = data.lines.map((line) => `
    <tr>
      <td>${String(line.description ?? '')}</td>
      <td>${String(line.quantity ?? 1)}</td>
      <td>${String(line.unit_amount_cents ?? 0)}</td>
      <td>${String(line.line_total_cents ?? 0)}</td>
    </tr>`).join('');
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Invoice ${invoiceNumber}</title></head>
  <body>
    <h1>Invoice ${invoiceNumber}</h1>
    <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Subtotal: ${String(data.invoice.subtotal_cents ?? 0)}</p>
    <p>Tax: ${String(data.invoice.tax_cents ?? 0)}</p>
    <p>Total: ${String(data.invoice.total_cents ?? 0)}</p>
  </body>
</html>`;
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  // Placeholder for a Puppeteer-backed renderer. Returning HTML bytes keeps callers testable now.
  return Buffer.from(renderInvoiceHtml(data), 'utf8');
}
