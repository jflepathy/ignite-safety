import clients from './data/clients.json';
// Node-only client — see prisma-client-node.ts and the comment in seed.ts.
import { prisma } from './prisma-client-node';

// ---------------------------------------------------------------------------
// One-time (re-runnable) import of Ignite Safety's real historical client
// roster -- built from the company's own servicing/invoice records
// (2022-2026) plus a contact-number directory, deduplicated and merged into
// prisma/data/clients.json. See README.md "Real client data import" for how
// this file was produced and how to re-run it.
//
// Idempotent: matches on displayName, so running this twice does not create
// duplicates -- it just updates existing rows with any newer info.
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Importing ${clients.length} real customers…`);
  let created = 0;
  let updated = 0;

  for (const c of clients as any[]) {
    const existing = await prisma.customer.findFirst({ where: { displayName: c.displayName } });
    const data = {
      displayName: c.displayName,
      phone: c.phone || undefined,
      address: c.address || undefined,
      region: c.region || undefined,
      contactPerson: c.contactPerson || undefined,
      notes: c.notes || undefined,
    };
    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.customer.create({ data });
      created++;
    }
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
