import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { sendEmail, EmailNotConfiguredError } from '@/lib/email';
import { buildDocumentPdf } from '@/lib/pdf/build-document-pdf';
import type { InvoiceDocumentData } from '@/components/billing/invoice-document';

/**
 * Session 22, round 11 — "email & whatsapp delivery of invoice" (Tier 3).
 * Unlike the WhatsApp button (a link only — see whatsapp-share-button.tsx
 * for why), this actually attaches a real PDF: confirmed by a direct
 * production test that jsPDF/buildDocumentPdf runs fine server-side in
 * the Workers runtime (loadLogo's `FileReader`/`Image` calls, which don't
 * exist there, throw and get caught by its own try/catch, falling back to
 * the text wordmark exactly as it already does in the browser on a fetch
 * failure — no special-casing needed).
 *
 * Requires RESEND_API_KEY (and ideally RESEND_FROM_EMAIL on a verified
 * domain) set via `wrangler secret put` — see email.ts. Without it, this
 * returns a clear 503 rather than a confusing failure.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;

  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        lineItems: { include: { taxRate: true, shopItem: true }, orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!invoice || invoice.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!invoice.customer.email) {
    return NextResponse.json({ error: `${invoice.customer.displayName} has no email address on file.` }, { status: 400 });
  }

  const currency = settings?.currencyCode ?? 'SCR';
  const companyName = settings?.companyName ?? 'Ignite Safety';

  const documentData: InvoiceDocumentData = {
    settings: {
      companyName,
      companyAddress: settings?.companyAddress ?? null,
      companyPhone: settings?.companyPhone ?? null,
      companyEmail: settings?.companyEmail ?? null,
      taxRegistrationNumber: settings?.taxRegistrationNumber ?? null,
      logoUrl: settings?.logoUrl ?? null,
      paymentInstructions: settings?.paymentInstructions ?? null,
      bankName: settings?.bankName ?? null,
      bankAccountName: settings?.bankAccountName ?? null,
      bankAccountNumber: settings?.bankAccountNumber ?? null,
    },
    documentNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toLocaleDateString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toLocaleDateString() : null,
    poNumber: invoice.poNumber,
    terms: invoice.terms,
    customer: {
      displayName: invoice.customer.displayName,
      address: invoice.customer.address,
      phone: invoice.customer.phone,
    },
    lineItems: invoice.lineItems.map((li) => ({
      id: li.id,
      sku: li.shopItem?.sku ?? null,
      description: li.description,
      quantity: li.quantity.toString(),
      unitPrice: li.unitPrice.toString(),
      discountPercent: li.discountPercent.toString(),
      taxName: li.taxRate?.name ?? null,
      lineTotal: li.lineTotal.toString(),
    })),
    currency,
    subtotal: invoice.subtotal.toString(),
    discountTotal: invoice.discountTotal.toString(),
    globalDiscountPercent: invoice.globalDiscountPercent.toString(),
    taxTotal: invoice.taxTotal.toString(),
    total: invoice.total.toString(),
    amountPaid: invoice.amountPaid.toString(),
    balanceDue: invoice.balanceDue.toString(),
    taxInclusive: invoice.taxInclusive,
    customerMessage: invoice.customerMessage,
  };

  let pdfBase64: string;
  try {
    const pdf = await buildDocumentPdf(documentData);
    const arrayBuffer = pdf.output('arraybuffer') as ArrayBuffer;
    pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
  } catch (e: any) {
    return NextResponse.json({ error: `Could not build the PDF: ${e.message}` }, { status: 500 });
  }

  const viewUrl = invoice.shareToken
    ? `${new URL(_req.url).origin}/share/invoice/${invoice.shareToken}`
    : null;

  const html = `
    <p>Hi ${escapeHtml(invoice.customer.displayName)},</p>
    <p>Please find attached your invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> from ${escapeHtml(companyName)}, for ${escapeHtml(currency)} ${Number(invoice.total).toFixed(2)}.</p>
    ${viewUrl ? `<p>You can also view it online: <a href="${viewUrl}">${viewUrl}</a></p>` : ''}
    <p>Thank you for your business.</p>
    <p>${escapeHtml(companyName)}</p>
  `;
  const text = `Hi ${invoice.customer.displayName},\n\nPlease find attached your invoice ${invoice.invoiceNumber} from ${companyName}, for ${currency} ${Number(invoice.total).toFixed(2)}.\n${viewUrl ? `\nYou can also view it online: ${viewUrl}\n` : ''}\nThank you for your business.\n${companyName}`;

  try {
    await sendEmail({
      to: invoice.customer.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${companyName}`,
      html,
      text,
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBase64 }],
    });
  } catch (e: any) {
    if (e instanceof EmailNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: `Could not send the email: ${e.message}` }, { status: 502 });
  }

  if (invoice.status === 'DRAFT') {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'SENT' } });
  }
  await prisma.auditLog.create({
    data: {
      userId: session!.user.id,
      action: 'INVOICE_EMAILED',
      entityType: 'Invoice',
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, to: invoice.customer.email },
    },
  });

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
