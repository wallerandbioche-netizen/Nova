# Sécurité et conformité

Ce document décrit ce qui est **implémenté**, avec l'emplacement du code, et ce qui reste à
faire avant une mise en production réelle.

## 1. Authentification

| Mesure                           | Implémentation                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Hachage des mots de passe        | `scrypt` (N=32768, r=8, p=1), sel aléatoire de 16 octets, paramètres stockés dans l'empreinte — `modules/auth/password.ts` |
| Comparaison en temps constant    | `timingSafeEqual`                                                                                                          |
| Rehash automatique               | Une empreinte aux paramètres obsolètes est remplacée à la connexion suivante                                               |
| Égalisation des temps de réponse | Une vérification est exécutée même pour un compte inexistant, afin de ne pas révéler son existence par le temps de réponse |
| Politique de mot de passe        | 10 caractères minimum, une lettre et un chiffre — appliquée par le même schéma Zod côté API et côté app                    |
| Jeton d'accès                    | JWT HS256, 15 minutes, `iss`/`aud`/`jti` vérifiés                                                                          |
| Jeton de rafraîchissement        | Opaque, 48 octets aléatoires ; **seule son empreinte SHA-256 est stockée**                                                 |
| Rotation                         | Chaque rafraîchissement révoque le jeton présenté et en émet un nouveau dans la même famille                               |
| Détection de réutilisation       | Présenter un jeton déjà consommé révoque **toute la famille** et journalise l'incident                                     |
| Fin de session                   | Déconnexion, changement de mot de passe et réinitialisation révoquent toutes les sessions                                  |

## 2. Autorisation

- L'identité provient **exclusivement** du jeton vérifié (`request.user`), jamais du corps de la
  requête. Un test d'intégration vérifie qu'un `userId` injecté dans le body est ignoré.
- Chaque ressource utilisateur passe par un garde de propriété (`assertOwnership`) :
  portefeuilles, positions, journal, briefings, conversations IA.
- Les fonctionnalités premium sont contrôlées côté serveur à partir de l'abonnement stocké
  (`SubscriptionService.getEffectivePlan`), jamais d'une information envoyée par le client.

## 3. Entrées

- Tout body, query et params traverse `parseInput` et un schéma Zod (`packages/validation`).
- Les montants refusent `NaN` et `Infinity` à la frontière : une valeur non finie ne peut pas
  atteindre un calcul de portefeuille.
- La pagination utilise un curseur opaque validé ; un curseur malformé renvoie 400, pas 500.
- Prisma est utilisé en requêtes paramétrées ; le seul `$executeRawUnsafe` du code est la
  troncature des tables dans le harnais de test, avec une liste littérale.

## 4. Limitation de débit

Configurable par variable d'environnement (`RATE_LIMIT_*`), appliquée globalement et renforcée
sur : `login`, `register`, `forgot-password`, `reset-password` et les routes IA. Les quotas
produit (questions IA par jour) sont distincts et appliqués par plan.

## 5. Secrets

- Aucun secret dans le dépôt : `.env` est ignoré par git, `.env.example` documente chaque clé.
- La configuration est validée au démarrage ; un `JWT_SECRET` resté à sa valeur d'exemple, ou
  l'absence de Redis, **empêchent le démarrage en production**.
- Les secrets ne sont jamais exposés au client : le mobile ne reçoit que l'URL de l'API.

## 6. Journalisation

- Rédaction centralisée (`infrastructure/logger.ts`) : `authorization`, `cookie`, `password`,
  `token`, `refreshToken`, `apiKey`… sont remplacés par `[redacted]`.
- Les journaux d'audit filtrent activement toute clé ressemblant à un identifiant ou à un
  montant (`AuditLogService.sanitize`), et un test le vérifie.
- Les adresses IP ne sont stockées que sous forme d'empreinte tronquée.
- Une erreur 500 ne renvoie jamais de message interne : seulement un `requestId` retrouvable
  dans les journaux.

## 7. En-têtes et transport

`@fastify/helmet` (CSP et HSTS actifs en production), CORS restreint à une liste d'origines
explicites, compression, limite de taille du corps à 1 Mo.

## 8. RGPD

| Exigence                           | Implémentation                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Minimisation                       | Le LLM ne reçoit que des pourcentages et une tranche de valeur, jamais l'identité ni les montants            |
| Consentement                       | Acceptation explicite des conditions à l'inscription, horodatée                                              |
| Export                             | `GET /account/export` — JSON complet, sans empreinte de mot de passe                                         |
| Suppression                        | `DELETE /account` — mot de passe + confirmation typée, anonymisation immédiate puis purge (job de rétention) |
| Cascade                            | Toutes les données rattachées à l'utilisateur sont supprimées par contrainte `onDelete: Cascade`             |
| Séparation analytics               | Liste blanche de propriétés, aucune donnée financière transmise                                              |
| Chiffrement                        | En transit (TLS au niveau de l'infrastructure) ; au repos selon le fournisseur de base de données            |
| Journalisation des accès sensibles | `audit_logs` : connexion, échec de connexion, réinitialisation, export, suppression, abonnement              |

## 9. Garde-fous IA

Au-delà du prompt système versionné (`services/ai/prompts.ts`), les garde-fous sont appliqués
par le code :

1. La sortie du modèle doit valider un schéma Zod, sinon elle est rejetée.
2. Un jeu d'expressions interdites (conseil d'achat/vente, rendement garanti, certitude sur le
   futur) est détecté et provoque le rejet — `packages/validation/src/llm.ts`.
3. Une source absente du contexte fourni est considérée comme inventée : la réponse est rejetée.
4. Après un rejet : un retry contrôlé, puis une réponse déterministe produite par le moteur.
5. Le bloc d'exposition personnelle n'est **jamais** rédigé par le modèle : il restitue des
   chiffres calculés, pour qu'aucune paraphrase ne puisse les déformer.

## 10. Ce qui reste à faire avant une production réelle

Ces points sont hors périmètre du MVP et doivent être traités avant une exposition publique :

- [ ] Audit de sécurité externe et test d'intrusion.
- [ ] Rotation programmée des secrets et intégration à un gestionnaire de secrets.
- [ ] Authentification à deux facteurs (l'interface `Security` est prête à l'accueillir).
- [ ] Détection d'anomalies sur les connexions (géolocalisation, appareils inconnus).
- [ ] Revue juridique des conditions d'utilisation et de la politique de confidentialité :
      les textes fournis décrivent fidèlement le comportement du code, mais n'ont pas été
      validés par un juriste.
- [ ] Analyse réglementaire préalable à toute fonctionnalité de recommandation personnalisée
      (le module `advisory` n'existe pas et ne doit pas être créé sans cette validation).
- [ ] Licences de données de marché correspondant à l'usage réel.
