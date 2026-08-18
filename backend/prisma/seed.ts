/**
 * Seed skripti — namunaviy menyu va test ma'lumotlari.
 * Ishga tushirish: npm run prisma:seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MENU_ITEMS = [
  {
    name: "Osh (palov)",
    description: "An'anaviy o'zbek palovi, mol go'shti bilan",
    price: 30000,
    category: "Asosiy taomlar",
    imageUrl: null,
  },
  {
    name: "Lag'mon",
    description: "Uy usulida tayyorlangan lag'mon",
    price: 25000,
    category: "Asosiy taomlar",
    imageUrl: null,
  },
  {
    name: "Manti (2 dona)",
    description: "Bug'da pishirilgan manti, smetana bilan",
    price: 20000,
    category: "Asosiy taomlar",
    imageUrl: null,
  },
  {
    name: "Sho'rva",
    description: "Issiq mol go'shti sho'rvasi",
    price: 22000,
    category: "Asosiy taomlar",
    imageUrl: null,
  },
  {
    name: "Non",
    description: "Tandir non",
    price: 4000,
    category: "Non va ichimliklar",
    imageUrl: null,
  },
  {
    name: "Choy (1 l)",
    description: "Ko'k choy / qora choy",
    price: 5000,
    category: "Non va ichimliklar",
    imageUrl: null,
  },
  {
    name: "Somsa (1 dona)",
    description: "Go'shtli somsa, tandirda",
    price: 10000,
    category: "Yengil atirlar",
    imageUrl: null,
  },
];

async function main() {
  console.log("🌱 Menyu ma'lumotlarini yuklash...");

  for (const item of MENU_ITEMS) {
    await prisma.menuItem.upsert({
      where: { name: item.name },
      update: {},
      create: item,
    });
  }

  const count = await prisma.menuItem.count();
  console.log(`✅ ${count} ta menyu taomi yuklandi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
