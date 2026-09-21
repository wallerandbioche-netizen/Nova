/**
 * Creates the SCAN TRADE product and its two prices in your Stripe account,
 * then prints the environment variables to copy.
 *
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
 *
 * Running it twice does not duplicate anything: the product is looked up by
 * its metadata first.
 */
const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  console.error('STRIPE_SECRET_KEY manquant.');
  console.error('Exemple : STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs');
  process.exit(1);
}

const MARKER = 'scan-trade';
const MONTHLY_CENTS = 2999;
const YEARLY_CENTS = 19999;

async function stripe(path, body) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Stripe a répondu ${response.status}`);
  }
  return payload;
}

async function findProduct() {
  const search = await stripe(
    `products/search?query=${encodeURIComponent(`metadata['app']:'${MARKER}'`)}`,
  );
  return search.data?.[0] ?? null;
}

async function findPrice(productId, interval) {
  const prices = await stripe(`prices?product=${productId}&active=true&limit=100`);
  return prices.data?.find((price) => price.recurring?.interval === interval) ?? null;
}

const product =
  (await findProduct()) ??
  (await stripe('products', {
    name: 'SCAN TRADE — Analyse complète',
    // Visible par le client sur la page de paiement, le reçu et la facture.
    description:
      'Analyse complète de vos captures de graphiques : zone d’entrée, stop et objectifs chiffrés, rapport risque / rendement, taille de position et raisonnement détaillé. Analyses illimitées et journal de fiabilité.',
    statement_descriptor: 'SCANTRADE',
    'metadata[app]': MARKER,
  }));

const monthly =
  (await findPrice(product.id, 'month')) ??
  (await stripe('prices', {
    product: product.id,
    currency: 'eur',
    unit_amount: String(MONTHLY_CENTS),
    'recurring[interval]': 'month',
    // Le libellé d'un tarif reste interne à Stripe : il n'apparaît pas au client.
    nickname: 'Mensuelle — 29,99 €/mois, sans engagement',
    lookup_key: 'scan_trade_mensuelle',
    'metadata[plan]': 'mensuelle',
  }));

const yearly =
  (await findPrice(product.id, 'year')) ??
  (await stripe('prices', {
    product: product.id,
    currency: 'eur',
    unit_amount: String(YEARLY_CENTS),
    'recurring[interval]': 'year',
    nickname: 'Annuelle — 199,99 €/an, soit 16,67 €/mois (2 mois offerts)',
    lookup_key: 'scan_trade_annuelle',
    'metadata[plan]': 'annuelle',
  }));

console.log('\nProduit et tarifs prêts dans Stripe.\n');
console.log('Ajoutez ces deux variables à votre hébergeur :\n');
console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
console.log(`STRIPE_PRICE_YEARLY=${yearly.id}`);
console.log('');
