const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const j = (v) => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x, 2);
(async () => {
  const rows = await prisma.client.findMany({
    where: { code: 'C001', societeId: 10 },
    orderBy: { id: 'asc' },
  });
  if (rows.length <= 1) {
    console.log('No duplicates to fix');
    await prisma.$disconnect();
    return;
  }
  const keep = rows[0];
  const dups = rows.slice(1);
  console.log('=== STEP 3: Keeping oldest ===');
  console.log(j({ id: keep.id, code: keep.code, nom: keep.nom }));
  for (const dup of dups) {
    const newCode = dup.code + '-DUP' + dup.id;
    const updated = await prisma.client.update({
      where: { id: dup.id },
      data: { code: newCode },
      select: { id: true, code: true, nom: true, societeId: true },
    });
    console.log('Renamed:', j(updated));
  }
  const after = await prisma.client.findMany({
    where: { societeId: 10, OR: [{ code: 'C001' }, { code: { startsWith: 'C001-DUP' } }] },
    orderBy: { id: 'asc' },
    select: { id: true, code: true, nom: true },
  });
  console.log('=== After fix (C001 group) ===');
  console.log(j(after));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
