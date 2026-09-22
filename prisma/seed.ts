import bcrypt from 'bcryptjs';
import { DEFAULT_LOGO_WHITE_BG, DEFAULT_LOGO_TRANSPARENT } from './assets/default-logos';
// Node-only client (see prisma-client-node.ts) — this script runs locally
// via tsx, not on Cloudflare Workers, so it can't use the app's wasm-based
// shared client (src/lib/prisma.ts). Both still talk to Neon over plain
// HTTPS via the same PrismaNeonHTTP adapter.
import { prisma } from './prisma-client-node';

// find-then-create instead of upsert() — the Neon HTTP driver adapter
// (needed so this app runs on Cloudflare Workers) doesn't support the
// implicit transaction Prisma wraps upsert() in. Every upsert below was of
// the "leave it alone if it exists, otherwise create it" shape (update: {}),
// so this is an exact behavioral match, re-runnable just like the upserts
// were.
async function findOrCreate<T>(
  delegate: { findUnique: (args: { where: any }) => Promise<T | null>; create: (args: { data: any }) => Promise<T> },
  where: any,
  data: any
): Promise<T> {
  const existing = await delegate.findUnique({ where });
  return existing ?? delegate.create({ data });
}

// ---------------------------------------------------------------------------
// This is the PRODUCTION seed: it sets up the operational scaffolding an
// empty instance of the app needs (login accounts, chart of accounts, tax
// rates, the equipment/service catalogs) but does NOT create any demo
// customers, invoices, work orders, expenses or employees — those are real
// go-live data, imported separately (see prisma/import-clients.ts) or
// entered by hand through the app.
// ---------------------------------------------------------------------------
async function main() {
  console.log('Seeding Ignite Safety (production scaffolding, no demo business data)…');

  // --- App Settings (singleton) -- from the Certificate of Registration
  // (BRN B8436760, dated 6 Mar 2024) and the SRC TIN Letter (TIN 999624349,
  // dated 12 Apr 2024) ---
  await findOrCreate(
    prisma.appSettings,
    { id: 1 },
    {
      id: 1,
      companyName: 'Ignite Safety',
      legalName: 'Ignite Safety',
      companyAddress: 'Les Rocher, Mahé, Seychelles',
      companyPhone: '+248 2 577 459',
      companyEmail: 'info@ignitesafety.sc',
      taxRegistrationNumber: '999624349',
      businessRegistrationNumber: 'B8436760',
      registeredOwners: 'Jean-Francois Innocent Lepathy, Zaynab Yasmin Mahomed Ghislain',
      businessType: 'Partnership',
      industry: 'Fire & Life Safety Equipment Servicing',
      currencyCode: 'SCR',
      logoUrl: DEFAULT_LOGO_WHITE_BG,
      faviconUrl: DEFAULT_LOGO_TRANSPARENT,
      invoiceTermsDefault: 'Payment due within 30 days of invoice date. Late payments subject to 2% monthly interest.',
      dailyTeamCapacity: 3,
      overdueThresholdDays: 30,
      defaultServiceIntervalMonths: 12,
      reminderLeadDays: 45,
    }
  );

  // --- Users ---
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await findOrCreate(
    prisma.user,
    { email: 'admin@ignitesafety.sc' },
    { name: 'Jean-Francois Lepathy', username: 'admin', email: 'admin@ignitesafety.sc', passwordHash, role: 'ADMIN' }
  );
  const sales = await findOrCreate(
    prisma.user,
    { email: 'sales@ignitesafety.sc' },
    { name: 'Marie-Ange Confait', username: 'sales', email: 'sales@ignitesafety.sc', passwordHash, role: 'SALES' }
  );
  const tech1 = await findOrCreate(
    prisma.user,
    { email: 'tech@ignitesafety.sc' },
    { name: 'Jonathan Camille', username: 'tech', email: 'tech@ignitesafety.sc', passwordHash, role: 'TECHNICIAN' }
  );
  const tech2 = await findOrCreate(
    prisma.user,
    { email: 'tech2@ignitesafety.sc' },
    { name: 'Keddy Barbe', username: 'tech2', email: 'tech2@ignitesafety.sc', passwordHash, role: 'TECHNICIAN' }
  );

  // --- Tax Rates ---
  const vat = await findOrCreate(
    prisma.taxRate,
    { id: 'seed-vat-15' },
    { id: 'seed-vat-15', name: 'SCR VAT 15%', ratePercent: 15, isDefault: true }
  );
  await prisma.appSettings.update({ where: { id: 1 }, data: { defaultTaxRateId: vat.id } });

  // --- Equipment Type Catalog ---
  const catalogEntries: { category: any; label: string; months: number; hydro: boolean }[] = [
    { category: 'FIRE_EXTINGUISHER', label: 'Fire Extinguisher', months: 12, hydro: true },
    { category: 'HOSE_REEL', label: 'Hose Reel', months: 12, hydro: false },
    { category: 'SUPPRESSION_SYSTEM', label: 'Suppression System', months: 12, hydro: false },
    { category: 'FIRE_BLANKET', label: 'Fire Blanket', months: 24, hydro: false },
    { category: 'LIFE_RAFT', label: 'Life Raft', months: 12, hydro: false },
    { category: 'SMOKE_DETECTOR', label: 'Smoke Detector', months: 12, hydro: false },
    { category: 'EMERGENCY_LIGHT', label: 'Emergency Light', months: 12, hydro: false },
    { category: 'FIRE_ALARM_PANEL', label: 'Fire Alarm Panel', months: 12, hydro: false },
  ];
  for (const c of catalogEntries) {
    await findOrCreate(
      prisma.equipmentTypeCatalog,
      { category: c.category },
      {
        category: c.category,
        label: c.label,
        defaultIntervalMonths: c.months,
        requiresHydrostatic: c.hydro,
      }
    );
  }

  // --- Real Service/Product Catalog -- derived from Ignite Safety's actual
  // 2024-2026 invoice history ("Sales by Product/Service Detail" exports),
  // not placeholder demo items. This is what technicians and sales actually
  // bill for, so the catalog is populated and usable from day one.
  const shopItemDefs = [
    { sku: 'SVC-EXT-SERVICE', name: 'Servicing of F/Ext', category: 'Service Charges', unitPrice: 148 },
    { sku: 'SVC-TAGS', name: 'Service Tags', category: 'Service Charges', unitPrice: 3.5 },
    { sku: 'SVC-BLANKET', name: 'Servicing of Fire Blanket', category: 'Service Charges', unitPrice: 35 },
    { sku: 'SVC-HOSE-REEL', name: 'Servicing of Fire Hose Reel', category: 'Service Charges', unitPrice: 60 },
    { sku: 'SVC-CYLINDER-PRESSURE', name: 'Pressurised of Cylinder', category: 'Service Charges', unitPrice: 80 },
    { sku: 'REFILL-ABC-DCP-KG', name: 'ABC (Dry Powder) Kg Refill', category: 'Refills', unitPrice: 135 },
    { sku: 'SVC-DISPLACEMENT', name: 'Displacement Charge', category: 'Service Charges', unitPrice: 850 },
    { sku: 'SVC-ANTI-RUST', name: 'Anti Rust Treatment', category: 'Service Charges', unitPrice: 80 },
    { sku: 'PART-PRESSURE-GAUGE', name: 'Pressure Gauge', category: 'Parts', unitPrice: 75 },
  ];
  const shopItems: Record<string, string> = {};
  for (const item of shopItemDefs) {
    const created = await findOrCreate(
      prisma.shopItem,
      { sku: item.sku },
      { ...item, unitPrice: item.unitPrice, taxable: true }
    );
    shopItems[item.sku] = created.id;
  }

  // --- Chart of Accounts ---
  const accountDefs: { code: string; name: string; type: any; subtype: string }[] = [
    { code: '1000', name: 'Operating Bank Account', type: 'ASSET', subtype: 'Bank' },
    { code: '1100', name: 'Accounts Receivable', type: 'ASSET', subtype: 'Accounts Receivable' },
    { code: '1200', name: 'Inventory Asset', type: 'ASSET', subtype: 'Other Current Asset' },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'Accounts Payable' },
    { code: '2100', name: 'VAT Payable', type: 'LIABILITY', subtype: 'Other Current Liability' },
    { code: '3000', name: "Owner's Equity", type: 'EQUITY', subtype: 'Equity' },
    { code: '4000', name: 'Service Income', type: 'INCOME', subtype: 'Income' },
    { code: '4100', name: 'Equipment Sales Income', type: 'INCOME', subtype: 'Income' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', subtype: 'Cost of Goods Sold' },
    { code: '6000', name: 'Vehicle & Fuel', type: 'EXPENSE', subtype: 'Expense' },
    { code: '6100', name: 'Parts & Supplies', type: 'EXPENSE', subtype: 'Expense' },
    { code: '6200', name: 'Salaries & Wages', type: 'EXPENSE', subtype: 'Expense' },
  ];
  const accounts: Record<string, string> = {};
  for (const a of accountDefs) {
    const acc = await findOrCreate(prisma.account, { code: a.code }, a);
    accounts[a.code] = acc.id;
  }
  // Bank account record is structural (mirrors the "Operating Bank Account"
  // GL account above) but starts at a real SCR 0 balance rather than a fake
  // demo figure — the user enters their actual opening balance once live.
  await findOrCreate(
    prisma.bankAccount,
    { accountId: accounts['1000'] },
    {
      accountId: accounts['1000'],
      name: 'Operating Bank Account',
      accountType: 'CHECKING',
      openingBalance: 0,
      currentBalance: 0,
      currencyCode: 'SCR',
    }
  );

  // --- Tags ---
  for (const t of [
    { name: 'VIP', color: '#f13f2b' },
    { name: 'Government', color: '#2563eb' },
    { name: 'Overdue Follow-up', color: '#d97706' },
  ]) {
    await findOrCreate(prisma.tag, { name: t.name }, t);
  }

  console.log('Seed complete.');
  console.log('Demo logins (username / password: password123):');
  console.log('  admin  (ADMIN)');
  console.log('  sales  (SALES)');
  console.log('  tech   (TECHNICIAN)');
  console.log('  tech2  (TECHNICIAN)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
