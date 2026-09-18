/**
 * Demo data: an account you can sign into immediately, with a listing whose photos are already
 * imported and analysed, so the product can be exercised the moment it starts.
 *
 *   pnpm --filter @nova/studio db:seed
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';
import { importListingForUser } from '../src/server/listings';
import { createVideo } from '../src/server/videos';
import { CONFIG_KEYS, DEFAULT_CREDIT_PACKS, DEFAULT_PLANS } from '../src/lib/config/pricing';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@nova.studio';
const DEMO_PASSWORD = 'demo-nova-studio';

async function main() {
  // Runtime configuration, so prices and credit costs can be changed without a deploy.
  for (const [key, value, description] of [
    [CONFIG_KEYS.creditCostPerVideo, 1, 'Crédits débités par vidéo générée'],
    [CONFIG_KEYS.signupBonusCredits, 3, 'Crédits offerts à l’inscription'],
    [CONFIG_KEYS.plans, DEFAULT_PLANS, 'Offres d’abonnement'],
    [CONFIG_KEYS.creditPacks, DEFAULT_CREDIT_PACKS, 'Packs de crédits à l’unité'],
  ] as const) {
    await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: value as object, description },
      update: { value: value as object, description },
    });
  }

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      name: 'Compte de démonstration',
      creditBalance: 25,
      subscription: { create: { plan: 'PRO', status: 'ACTIVE' } },
    },
    update: { creditBalance: 25 },
  });

  const existing = await prisma.listing.findFirst({ where: { userId: user.id } });
  if (existing) {
    console.log('Le jeu de démonstration existe déjà.');
  } else {
    // Goes through the real importer: the seeded photos are analysed exactly like imported ones.
    const imported = await importListingForUser(user.id, 'https://demo.nova.studio/villa');
    console.log(`Annonce importée : ${imported.listing.images.length} photos analysées.`);

    const video = await createVideo({
      userId: user.id,
      listingId: imported.listing.id,
      imageIds: imported.suggestedSelection,
      name: 'Villa Bellevue — 9:16',
      style: 'CINEMATIC',
      aspectRatio: 'VERTICAL',
      duration: 'S30',
    });
    console.log(`Projet vidéo créé : ${video.id} (non généré — cliquez sur « Générer »).`);
  }

  console.log('\nCompte de démonstration');
  console.log(`  e-mail      : ${DEMO_EMAIL}`);
  console.log(`  mot de passe: ${DEMO_PASSWORD}`);
  console.log('  crédits     : 25');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
