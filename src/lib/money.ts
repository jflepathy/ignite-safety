export type LineItemInput = {
  quantity: number;
  unitPrice: number;
  discountPercent?: number; // item-level discount, 0-100
  taxRatePercent?: number; // resolved tax rate for this line, 0-100
};

export type LineItemComputed = LineItemInput & {
  lineSubtotal: number; // qty * unitPrice (as entered — gross if inclusive, net if exclusive)
  lineDiscount: number; // combined item + global discount amount, same basis as lineSubtotal
  lineTaxable: number; // net (ex-tax) amount after discounts — the true tax base
  lineTax: number;
  lineTotal: number; // always tax-inclusive: what the customer actually pays for this line
};

export type DocumentTotals = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  lines: LineItemComputed[];
};

/**
 * Computes line and document totals for invoices/estimates/sales
 * orders/receipts/credit notes.
 *
 * Order of operations: item-level % discount is applied first, then the
 * global document-level % discount is applied proportionally across lines.
 *
 * `inclusive` controls how `unitPrice` is interpreted (QuickBooks-style
 * "Tax Exclusive" vs "Tax Inclusive" line item option):
 *  - exclusive (default): unitPrice excludes tax; tax is added on top.
 *  - inclusive: unitPrice already includes tax; tax is backed out of the
 *    discounted gross amount so `lineTotal` is unchanged by the toggle for
 *    the same entered price, but `subtotal`/`taxTotal` split differently.
 */
export function computeDocumentTotals(
  items: LineItemInput[],
  globalDiscountPercent = 0,
  inclusive = false
): DocumentTotals {
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const lines = items.map((item) => {
    const gross = item.quantity * item.unitPrice;
    const itemDiscountAmt = gross * ((item.discountPercent ?? 0) / 100);
    const afterItemDiscount = gross - itemDiscountAmt;
    const afterGlobalDiscount = afterItemDiscount * (1 - globalDiscountPercent / 100);
    const taxRate = (item.taxRatePercent ?? 0) / 100;

    let lineTaxableNet: number;
    let lineTax: number;
    let lineTotal: number;

    if (inclusive && taxRate > 0) {
      lineTotal = afterGlobalDiscount; // already tax-inclusive
      lineTaxableNet = afterGlobalDiscount / (1 + taxRate);
      lineTax = afterGlobalDiscount - lineTaxableNet;
    } else {
      lineTaxableNet = afterGlobalDiscount;
      lineTax = afterGlobalDiscount * taxRate;
      lineTotal = afterGlobalDiscount + lineTax;
    }

    return {
      ...item,
      lineSubtotal: round2(gross),
      lineDiscount: round2(gross - afterGlobalDiscount),
      lineTaxable: round2(lineTaxableNet),
      lineTax: round2(lineTax),
      lineTotal: round2(lineTotal),
    };
  });

  // Subtotal is the sum of entered gross amounts (qty × unitPrice) before any
  // discount — matches the existing Subtotal / -Discount / +Tax / =Total
  // display contract used across invoice, estimate and receipt pages.
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineSubtotal, 0));
  const discountTotal = round2(lines.reduce((sum, l) => sum + l.lineDiscount, 0));
  const taxTotal = round2(lines.reduce((sum, l) => sum + l.lineTax, 0));
  const total = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));

  return { subtotal, discountTotal, taxTotal, total, lines };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

/** Integer -> English words (supports up to billions — comfortably more
 * than any real invoice amount). Used for cheque instructions on the
 * technician payment-collection bridge (Session 16). */
export function integerToWords(value: number): string {
  if (value === 0) return 'Zero';
  const groups = ['', ' Thousand', ' Million', ' Billion'];
  let n = Math.floor(value);
  const chunks: string[] = [];
  let groupIdx = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) chunks.unshift(threeDigitsToWords(chunk) + groups[groupIdx]);
    n = Math.floor(n / 1000);
    groupIdx++;
  }
  return chunks.join(' ');
}

/** "One Hundred Only SCR" (no cents) / "One Hundred Cents Ten Only SCR"
 * (with cents) — the cheque-writing style amount-in-words shown to a
 * technician collecting a cheque payment. */
export function amountInWords(amount: number, currency = 'SCR'): string {
  const rounded = Math.round(amount * 100) / 100;
  const whole = Math.floor(rounded);
  const cents = Math.round((rounded - whole) * 100);
  return cents > 0
    ? `${integerToWords(whole)} Cents ${integerToWords(cents)} Only ${currency}`
    : `${integerToWords(whole)} Only ${currency}`;
}

export function formatMoney(amount: number | string, currency = 'SCR'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  })
    .format(n)
    .replace(currency, currency)
    .trim();
}
