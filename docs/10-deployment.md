# Déploiement

## 1. Environnements

| Environnement | Base de données                     | Cache / jobs              | Fournisseurs | Déclenchement                       |
| ------------- | ----------------------------------- | ------------------------- | ------------ | ----------------------------------- |
| development   | PostgreSQL local                    | Mémoire (Redis optionnel) | `demo`       | manuel                              |
| staging       | PostgreSQL managé                   | Redis managé              | clés de test | automatique sur `main`              |
| production    | PostgreSQL managé, chiffré au repos | Redis managé              | clés réelles | **validation manuelle obligatoire** |

La protection de l'environnement `production` dans GitHub (required reviewers) matérialise
l'étape de validation : le pipeline ne peut pas y déployer seul.

## 2. Pipeline

```
git push
   ↓
lint → format → typecheck → tests unitaires        (job « quality »)
   ↓
build des packages → migrations → seed → build API → tests d'intégration et E2E   (job « integration »)
   ↓
export du bundle mobile                             (job « mobile »)
   ↓
déploiement staging (branche main)
   ↓
validation manuelle → production
```

Le job `mobile` existe parce qu'un typecheck ne détecte pas un module que le bundler ne sait pas
résoudre : seul un export réel le prouve.

## 3. Processus de déploiement de l'API

```bash
# 1. Migrations — toujours avant le déploiement du code
pnpm --filter @nova/api exec prisma migrate deploy

# 2. Image
docker build -f infrastructure/Dockerfile.api -t nova-api:$(git rev-parse --short HEAD) .

# 3. Déploiement, puis vérification
curl -fsS https://<host>/health/ready
```

Les migrations Prisma sont conçues pour être compatibles avec la version précédente du code
(ajout de colonnes nullable, pas de suppression immédiate), afin qu'un déploiement progressif
ou un retour arrière ne casse pas l'instance restée en place.

## 4. Jobs

Deux modes, selon la présence de Redis :

- **Avec Redis** : un processus worker dédié (`pnpm --filter @nova/api jobs`) consomme la file
  BullMQ. Les tâches répétées sont enregistrées une seule fois, donc une API répliquée ne génère
  pas un briefing par instance.
- **Sans Redis** : l'API exécute un ordonnanceur en mémoire. Adapté au développement, à une
  instance unique — pas à une production répliquée.

Sur les instances d'API qui ne doivent pas exécuter de tâches : `JOBS_ENABLED=false`.

Exécution ponctuelle :

```bash
pnpm --filter @nova/api jobs -- daily            # tout le pipeline matinal
pnpm --filter @nova/api jobs -- news:ingest      # une seule tâche
```

## 5. Variables d'environnement de production

Minimum requis (la configuration refuse de démarrer sinon) :

```
NODE_ENV=production
DATABASE_URL=…
REDIS_URL=…                  # obligatoire en production
JWT_SECRET=…                 # openssl rand -base64 48
MAIL_PROVIDER=http           # "log" est refusé en production
MAIL_API_URL=…
CORS_ORIGINS=https://…
```

## 6. Application mobile

```bash
pnpm build:packages
cd apps/mobile

npx expo export --platform web --output-dir dist   # version web
eas build --platform ios                          # nécessite un compte Expo
eas build --platform android
```

L'URL de l'API est lue dans `app.json` (`extra.apiBaseUrl`) et doit pointer vers l'API de
l'environnement visé au moment du build.

## 7. Observabilité

- Journaux structurés JSON (pino), avec `requestId`, route, statut et durée.
- Chaque exécution de job écrit une ligne `job_runs` : statut, durée, erreur tronquée.
- Chaque appel au LLM journalise le fournisseur, la latence, les jetons consommés et si la
  réponse est un repli déterministe — de quoi suivre le coût et la qualité.
- `GET /health/ready` détaille l'état de chaque dépendance et indique si les données servies
  sont des données de démonstration.

## 8. Sauvegardes et restauration

- Sauvegarde quotidienne de PostgreSQL avec restauration à un instant donné (PITR).
- Redis ne contient que du cache et des files : sa perte est sans conséquence sur les données.
- Restauration à tester périodiquement — une sauvegarde jamais restaurée n'est pas une
  sauvegarde.
