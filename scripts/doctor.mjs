#!/usr/bin/env node
/**
 * NOVA — diagnostic.
 *
 *   pnpm verify
 *
 * Répond à « pourquoi ça ne marche pas ? » : chaque vérification indique ce qui manque et la
 * commande qui le corrige. Ne modifie rien.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_ENV = join(ROOT, 'apps/api/.env');

const results = [];
const check = (label, status, detail, remedy) => results.push({ label, status, detail, remedy });

function envValue(key) {
  if (!existsSync(API_ENV)) return null;
  return /^[^#\n]*?\b(?:KEY)\b/.test(key)
    ? null
    : (new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(API_ENV, 'utf8'))?.[1]?.trim() ?? null);
}

// ---------------------------------------------------------------- configuration
if (!existsSync(API_ENV)) {
  check('Configuration', 'ko', 'apps/api/.env est absent', 'pnpm bootstrap');
} else {
  const secret = envValue('JWT_SECRET') ?? '';
  const weak = secret.length < 32 || secret.includes('change-me');
  check(
    'Configuration',
    weak ? 'ko' : 'ok',
    weak ? 'JWT_SECRET absent ou trop court' : 'apps/api/.env présent',
    weak ? 'Supprimez apps/api/.env puis relancez  pnpm bootstrap' : undefined,
  );

  const cors = envValue('CORS_ORIGINS');
  check(
    'CORS (cible web)',
    cors ? 'ok' : 'warn',
    cors ? cors : 'aucune origine autorisée',
    cors ? undefined : 'Ajoutez CORS_ORIGINS=http://localhost:8081 dans apps/api/.env',
  );
}

// ---------------------------------------------------------------- packages built
const built = existsSync(join(ROOT, 'packages/types/dist/index.js'));
check(
  'Packages compilés',
  built ? 'ok' : 'ko',
  built ? 'packages/*/dist présents' : 'dist manquant',
  built ? undefined : 'pnpm build:packages',
);

// ---------------------------------------------------------------- database
/** Runs a statement through Prisma against the schema's configured datasource. */
function query(sql) {
  return execSync(
    'pnpm --filter @nova/api exec prisma db execute --schema prisma/schema.prisma --stdin',
    {
      cwd: ROOT,
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    },
  );
}

let dbReachable = false;
try {
  query('SELECT 1;');
  dbReachable = true;
  check('Base de données', 'ok', 'PostgreSQL répond');
} catch (error) {
  const output = `${error?.stdout ?? ''}${error?.stderr ?? ''}`;
  const missing = /P1003|does not exist/i.test(output);
  check(
    'Base de données',
    'ko',
    missing ? 'la base n’existe pas encore' : 'PostgreSQL injoignable',
    missing ? 'pnpm bootstrap' : 'pnpm infra:up   (ou vérifiez DATABASE_URL dans apps/api/.env)',
  );
}

// ---------------------------------------------------------------- schema and seed
if (dbReachable) {
  try {
    query('SELECT 1 FROM assets LIMIT 1;');
    check('Schéma', 'ok', 'tables présentes');
  } catch {
    check('Schéma', 'ko', 'les tables sont absentes', 'pnpm db:migrate && pnpm db:seed');
  }

  try {
    query("SELECT 1 FROM users WHERE email = 'demo@nova.app';");
    check('Compte de démonstration', 'ok', 'demo@nova.app / demo-nova-2026');
  } catch {
    check('Compte de démonstration', 'warn', 'absent', 'pnpm db:seed');
  }
}

// ---------------------------------------------------------------- running API
try {
  const response = await fetch('http://127.0.0.1:4000/health/ready', {
    signal: AbortSignal.timeout(2500),
  });
  const body = await response.json();
  const demo = body.demoData?.marketData || body.demoData?.news;
  check(
    'API',
    response.ok ? 'ok' : 'warn',
    `${body.status}${demo ? ' — données de démonstration' : ''}`,
  );
} catch {
  check('API', 'warn', 'ne répond pas sur le port 4000', 'pnpm dev:api');
}

// ---------------------------------------------------------------- report
console.log('\nNOVA — diagnostic\n');
const symbols = { ok: 'OK  ', warn: '!   ', ko: 'KO  ' };
for (const result of results) {
  console.log(`  ${symbols[result.status]}${result.label.padEnd(22)} ${result.detail}`);
  if (result.remedy) console.log(`      → ${result.remedy}`);
}

const broken = results.filter((result) => result.status === 'ko');
console.log(
  broken.length === 0
    ? '\nTout est en place. Lancez  pnpm dev\n'
    : `\n${broken.length} point(s) à corriger avant de lancer l’application.\n`,
);
process.exit(broken.length === 0 ? 0 : 1);
