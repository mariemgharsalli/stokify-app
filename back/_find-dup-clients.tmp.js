const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const j = (v) => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x, 2);
(async () => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT code, societeId, COUNT(*) as cnt FROM Client GROUP BY code, societeId HAVING COUNT(*) > 1'
  );
  console.log('=== STEP 2: Duplicate groups ===');
  console.log(j(rows));
  const c001 = await prisma.client.findMany({
    where: { code: 'C001', societeId: 10 },
    orderBy: { id: 'asc' },
    select: { id: true, code: true, nom: true, societeId: true }
  });
  console.log('=== C001 societeId 10 (before fix) ===');
  console.log(j(c001));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
