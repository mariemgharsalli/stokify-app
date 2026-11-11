const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const societe = await prisma.societe.upsert({
    where: { code: "SOC001" },
    update: {},
    create: { code: "SOC001", nom: "Entreprise Demo", email: "admin@demo.com" },
  });

  await prisma.depot.upsert({
    where: { code_societeId: { code: "DEP001", societeId: societe.id } },
    update: {},
    create: { code: "DEP001", libelle: "Depot Principal", societeId: societe.id },
  });

  const hashAdmin = await bcrypt.hash("Admin123!", 10);
  const hashSuper = await bcrypt.hash("SuperAdmin123!", 10);

  await prisma.utilisateur.upsert({
    where: { email: "admin@stokify.com" },
    update: {
      nom: "Entreprise",
      prenom: "Admin",
      motDePasse: hashAdmin,
      role: "ADMIN",
      actif: true,
      societeId: societe.id,
    },
    create: {
      nom: "Entreprise",
      prenom: "Admin",
      email: "admin@stokify.com",
      motDePasse: hashAdmin,
      role: "ADMIN",
      societeId: societe.id,
    },
  });

  await prisma.utilisateur.upsert({
    where: { email: "superadmin@stokify.com" },
    update: {
      nom: "Root",
      prenom: "SuperAdmin",
      motDePasse: hashSuper,
      role: "SUPER_ADMIN",
      actif: true,
      societeId: societe.id,
    },
    create: {
      nom: "Root",
      prenom: "SuperAdmin",
      email: "superadmin@stokify.com",
      motDePasse: hashSuper,
      role: "SUPER_ADMIN",
      societeId: societe.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed termine: admin@stokify.com / Admin123! | superadmin@stokify.com / SuperAdmin123!");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
