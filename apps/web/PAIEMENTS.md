# Activer les comptes et les paiements

L'application fonctionne sans rien configurer : moteur d'analyse complet, abonnement simulé.
Ce guide branche les trois services qui la rendent réellement vendable — comptes, paiements,
e-mails. Comptez trente minutes, aucune ligne de code à écrire.

Rien n'est bloquant : chaque service activé débloque sa partie, et l'application dit toujours
où elle en est plutôt que de faire semblant.

| Ce que vous branchez | Ce que ça débloque                                           |
| -------------------- | ------------------------------------------------------------ |
| Base de données      | Les comptes, la connexion, le journal multi-appareils        |
| Envoi d'e-mails      | Le lien de connexion arrive dans la boîte de l'abonné        |
| Stripe               | Le paiement réel, les reçus, la résiliation en libre-service |
| Clé Anthropic        | La lecture des captures d'écran                              |

---

## 1. La base de données (5 min)

Elle mémorise les comptes et les abonnements. N'importe quel Postgres convient ; le plus
simple est **Neon**, gratuit et intégré à Vercel.

1. Créez un compte sur <https://neon.tech> → **New project**.
2. Copiez la chaîne de connexion proposée (elle commence par `postgresql://`).
3. Ajoutez-la à votre hébergeur sous le nom **`DATABASE_URL`**.
4. Ajoutez aussi **`SESSION_SECRET`** : une longue chaîne aléatoire, qui signe les sessions.
   Pour en générer une :

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

Les tables sont créées automatiquement au premier passage — rien à exécuter à la main.

## 2. L'envoi d'e-mails (5 min)

La connexion se fait par lien envoyé par e-mail : pas de mot de passe à choisir, à retenir
ni à fuiter.

1. Créez un compte sur <https://resend.com> → **API Keys** → **Create**.
2. Ajoutez la clé sous le nom **`RESEND_API_KEY`**.
3. Optionnel : une fois votre domaine vérifié chez Resend, définissez **`EMAIL_FROM`**, par
   exemple `SCAN TRADE <bonjour@votredomaine.com>`.

Sans cette étape, l'application fonctionne quand même : le lien de connexion est écrit dans
les journaux du serveur au lieu d'être envoyé. Pratique pour tester, inutilisable en
production.

## 3. Stripe (15 min)

1. Créez un compte sur <https://stripe.com>.
2. **Developers → API keys** → copiez la **clé secrète** (`sk_test_…` en test,
   `sk_live_…` en production) → ajoutez-la sous **`STRIPE_SECRET_KEY`**.
3. Créez les deux formules en une commande, depuis le dossier de l'application :

   ```bash
   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
   ```

   Le script crée le produit et les tarifs 29,99 €/mois et 199,99 €/an, puis affiche les deux
   variables à copier : **`STRIPE_PRICE_MONTHLY`** et **`STRIPE_PRICE_YEARLY`**. Le relancer
   ne crée pas de doublon.

4. **Developers → Webhooks → Add endpoint** :
   - URL : `https://votre-site.com/api/billing/webhook`
   - Événements : `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copiez le **Signing secret** (`whsec_…`) sous **`STRIPE_WEBHOOK_SECRET`**

   Ce webhook est ce qui ouvre l'accès après un paiement : sans lui, l'abonné paie et reste
   bloqué.

5. **Settings → Billing → Customer portal** → activez-le. C'est lui qui gère le changement
   de carte, les factures et la résiliation, sans que vous ayez à les développer.

## 4. Redéployer

Ajoutez toutes ces variables chez votre hébergeur (sur Vercel : _Settings → Environment
Variables_), puis **redéployez** : une variable ajoutée après un déploiement ne s'applique
qu'au suivant.

---

## Vérifier que tout marche

1. Ouvrez le site → **Profil** → saisissez votre adresse → vous recevez le lien → cliquez.
   Vous devez voir votre adresse et le bouton **Se déconnecter**.
2. **Abonnement** → **Choisir cette formule** → vous arrivez sur la page de paiement Stripe.
   En mode test, la carte `4242 4242 4242 4242` (date future, CVC au hasard) valide un
   paiement.
3. De retour sur le site, l'analyse complète est débloquée et **Profil** affiche la date de
   renouvellement.
4. Reconnectez-vous depuis un autre appareil avec la même adresse : l'abonnement et le
   journal suivent.

Si l'étape 3 ne débloque rien, c'est le webhook : vérifiez dans Stripe
(**Developers → Webhooks → votre endpoint**) que les événements partent bien en `200`.

## Passer en production

Stripe démarre en mode test. Quand vous êtes prêt : activez votre compte Stripe (**Activate
account**), remplacez la clé secrète et les deux tarifs par ceux du mode live, recréez le
webhook sur l'URL de production, et redéployez.

## Ce qui reste à votre charge

Vendre un abonnement engage juridiquement : conditions générales de vente, politique de
confidentialité (vous stockez des adresses e-mail), droit de rétractation, et mentions sur
le fait qu'une analyse de marché n'est pas un conseil en investissement. L'application
affiche déjà cette dernière réserve à chaque analyse, mais les documents contractuels
restent à écrire.
