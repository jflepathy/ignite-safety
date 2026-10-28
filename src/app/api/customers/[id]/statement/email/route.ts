import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { sendEmail, EmailNotConfiguredError } from '@/lib/email';
import { buildStatement } from '@/lib/statement';
import { buildStatementPdf } from '@/lib/pdf/build-statement-pdf';
import { formatMoney } from '@/lib/money';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireRole('ADMIN', 'SALES');
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const data = await buildStatement(params.id, {
    from: body.from ? new Date(body.from) : null,
    to: body.to ? new Date(body.to) : null,
  });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!data.customer.email) return NextResponse.json({ error: `${data.customer.displayName} has no email address on file.` }, { status: 400 });

  const pdf = buildStatementPdf(data);
  const b64 = Buffer.from(pdf.output('arraybuffer')).toString('base64');
  const company = data.settings.companyName;
  const due = formatMoney(data.closingBalance, data.currency);
  try {
    await sendEmail({
      to: data.customer.email,
      subject: `Statement of account from ${company}`,
      text: `Dear ${data.customer.displayName},\n\nPlease find attached your statement of account dated ${data.statementDate}. The amount due is ${due}.\n\nThank you,\n${company}`,
      html: `<p>Dear ${data.customer.displayName},</p><p>Please find attached your statement of account dated ${data.statementDate}. The amount due is <strong>${due}</strong>.</p><p>Thank you,<br/>${company}</p>`,
      attachments: [{ filename: `Statement_${data.customer.displayName.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`, content: b64 }],
    });
  } catch (e: any) {
    if (e instanceof EmailNotConfiguredError) return NextResponse.json({ error: e.message }, { status: 503 });
    return NextResponse.json({ error: e.message || 'Could not send.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
