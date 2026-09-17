#!/usr/bin/env node
/**
 * NOVA — mise en route.
 *
 *   pnpm bootstrap
 *
 * Idempotent : peut être relancé sans risque. Ne remplace jamais un `.env` existant, ne
 * supprime aucune donnée, et s'arrête avec un message explicite dès qu'une étape échoue plutôt
 * que de laisser une installation à moitié faite.
 */
import { execSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_ENV = join(ROOT, 'apps/api/.env');

let step = 0;
const TOTAL = 6;
const heading = (text) => console.log(`\n[${++step}/${TOTAL}] ${text}`);
const ok = (text) => console.log(`  OK  ${text}`);
const info = (text) => console.log(`      ${text}`);
const warn = (text) => console.log(`  !   ${text}`);

function fail(text, remedy) {
  console.error(`\nECHEC : ${text}`);
  if (remedy) console.error(`\n${remedy}\n`);
  process.exit(1);
}

function run(command, options = {}) {
  return execSync(command, {
    cwd: ROOT,
    stdio: options.quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
}

function has(command) {
  return spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' }).status === 0;
}

/** Resolves once something accepts a TCP connection on the port, or times out. */
function waitForPort(port, host = '127.0.0.1', timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = () => {
      const socket = createConnection({ port, host });
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      const retry = () => {
        socket.destroy();
        if (Date.now() > deadline) return resolve(false);
        setTimeout(attempt, 700);
      };
      socket.on('error', retry);
      socket.on('timeout', retry);
    };
    attempt();
  });
}

// ---------------------------------------------------------------- 1. prerequisites
heading('Vérification des prérequis');

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) {
  fail(
    `Node ${process.versions.node} détecté, Node 20.11 ou plus récent est requis.`,
    'Installez une version récente : https://nodejs.org',
  );
}
ok(`Node ${process.versions.node}`);

if (!has('pnpm')) {
  fail(
    'pnpm est introuvable.',
    'Installez-le avec :  corepack enable && corepack prepare pnpm@10 --activate',
  );
}
ok(`pnpm ${run('pnpm --version', { quiet: true }).trim()}`);

// ---------------------------------------------------------------- 2. dependencies
heading('Installation des dépendances');
run('pnpm install');
ok('dépendances installées');

// ---------------------------------------------------------------- 3. configuration
heading('Configuration');

if (existsSync(API_ENV)) {
  ok('apps/api/.env existe déjà, il n’est pas modifié');
  if (!/^CORS_ORIGINS=.+/m.test(readFileSync(API_ENV, 'utf8'))) {
    warn(
      'CORS_ORIGINS n’est pas renseigné : la cible web sera bloquée par le navigateur. ' +
        'Ajoutez par exemple CORS_ORIGINS=http://localhost:8081',
    );
  }
} else {
  // A real secret, generated locally. The file is git-ignored.
  const secret = randomBytes(48).toString('base64');
  writeFileSync(
    API_ENV,
    [
      '# Généré par `pnpm setup`. Ce fichier est ignoré par git : ne le committez pas.',
      'NODE_ENV=development',
      'LOG_LEVEL=info',
      '',
      'DATABASE_URL=postgresql://nova:nova@127.0.0.1:5432/nova_dev?schema=public',
      'TEST_DATABASE_URL=postgresql://nova:nova@127.0.0.1:5432/nova_test?schema=public',
      '',
      `JWT_SECRET=${secret}`,
      '',
      '# Origines autorisées pour la cible web. iOS et Android n’envoient pas d’en-tête Origin',
      '# et fonctionnent sans ce réglage.',
      'CORS_ORIGINS=http://localhost:8081,http://localhost:19006,http://localhost:8090',
      '',
      '# Tous les fournisseurs externes sont en mode démonstration.',
      '# Voir docs/08-providers.md pour brancher des données réelles.',
      'MARKET_DATA_PROVIDER=demo',
      'NEWS_PROVIDER=demo',
      'LLM_PROVIDER=demo',
      'MAIL_PROVIDER=log',
      'PAYMENT_PROVIDER=none',
      '',
    ].join('\n'),
  );
  ok('apps/api/.env créé, avec un JWT_SECRET généré aléatoirement');
}

// ---------------------------------------------------------------- 4. database
heading('Base de données PostgreSQL');

const dbUrl = /^DATABASE_URL=(.+)$/m.exec(readFileSync(API_ENV, 'utf8'))?.[1] ?? '';
const port = Number(/:(\d+)\//.exec(dbUrl)?.[1] ?? 5432);

if (await waitForPort(port, '127.0.0.1', 1500)) {
  ok(`PostgreSQL répond déjà sur le port ${port}`);
} else {
  let started = false;

  if (has('docker')) {
    info('démarrage du conteneur PostgreSQL…');
    try {
      run('docker compose -f infrastructure/docker-compose.yml up -d postgres', { quiet: true });
      started = await waitForPort(port);
    } catch {
      // Docker can be installed without a running daemon; the local route below still works.
      started = false;
    }
  }

  if (started) {
    ok('PostgreSQL démarré (Docker)');
  } else {
    fail(
      `Aucune base PostgreSQL ne répond sur le port ${port}.`,
      'Démarrez-en une, puis relancez  pnpm bootstrap :\n\n' +
        '  avec Docker              pnpm infra:up\n' +
        '  avec un PostgreSQL local sudo service postgresql start\n' +
        '                           createdb nova_dev && createdb nova_test\n\n' +
        'Ou faites pointer DATABASE_URL (apps/api/.env) vers une base existante.',
    );
  }
}

// ---------------------------------------------------------------- 5. schema and data
heading('Schéma et données de démonstration');

run('pnpm build:packages', { quiet: true });
info('packages compilés');

run('pnpm --filter @nova/api exec prisma generate', { quiet: true });
info('client Prisma généré');

const databaseName = /\/([^/?]+)(\?|$)/.exec(dbUrl)?.[1] ?? 'nova_dev';
try {
  run('pnpm --filter @nova/api exec prisma migrate deploy', { quiet: true });
} catch (error) {
  const output = `${error?.stdout ?? ''}${error?.stderr ?? ''}`;
  const missingDatabase = /P1003|does not exist|n'existe pas/i.test(output);
  fail(
    missingDatabase
      ? `La base « ${databaseName} » n’existe pas encore.`
      : 'Les migrations n’ont pas pu être appliquées.',
    missingDatabase
      ? `Créez-la, puis relancez  pnpm bootstrap :\n\n  createdb ${databaseName}\n` +
          `  createdb ${databaseName.replace(/_dev$/, '_test')}`
      : 'Vérifiez que DATABASE_URL (apps/api/.env) pointe vers une base accessible.',
  );
}
ok('migrations appliquées');

run('pnpm --filter @nova/api db:seed', { quiet: true });
ok('données de référence et de démonstration insérées');

// ---------------------------------------------------------------- 6. done
heading('Terminé');

console.log(`
  Lancer NOVA

    pnpm dev          API + application mobile
    pnpm dev:api      API seule, documentation sur http://localhost:4000/docs
    pnpm verify       vérifier que tout répond

  Compte de démonstration

    demo@nova.app / demo-nova-2026

  Les données de marché et d’actualité sont des données de démonstration,
  signalées par la mention DEMO DATA dans l’application.
`);
