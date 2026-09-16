# E. Screen map

## Navigation

```
RootLayout
├── (public)                     non authentifié
│   ├── splash
│   ├── welcome                  landing / présentation
│   ├── login
│   ├── signup
│   ├── forgot-password
│   ├── terms
│   └── privacy
├── (onboarding)                 authentifié, onboarding non terminé
│   ├── goal          (étape 2)
│   ├── horizon       (étape 3)
│   ├── experience    (étape 4)
│   ├── risk          (étape 5 — scénarios, pas de slider)
│   ├── assets        (étape 6)
│   ├── portfolio     (étape 7 — positions manuelles)
│   └── ready         (étape 8)
└── (app)                        authentifié, onboarding terminé — bottom tabs
    ├── index           Accueil (Dashboard)
    ├── markets         Marchés (overview + Market Radar)
    ├── portfolio       Portefeuille
    ├── learn           Apprendre
    └── profile         Profil
    modales / piles :
    ├── brief/[id]      Daily Brief
    ├── news/[id]       News detail + « Pourquoi cela vous concerne ? »
    ├── asset/[id]      Asset detail
    ├── coach           AI Coach (accessible du dashboard et des pages pertinentes)
    ├── lesson/[id]     Lesson detail
    ├── journal         Journal
    ├── journal/[id]    Journal detail
    ├── journal/new     Nouvelle entrée
    ├── notifications   Notifications
    ├── settings        Paramètres
    ├── settings/security       Sécurité (mot de passe, sessions)
    ├── settings/notifications  Préférences de notification
    ├── settings/subscription   Abonnement
    ├── settings/delete-account Suppression du compte
    └── help            Aide
```

Bottom navigation : **Accueil · Marchés · Portefeuille · Apprendre · Profil**.
Le chat NOVA est atteignable depuis le dashboard (bouton « Demander à NOVA ») et depuis
chaque écran de contexte (news, portefeuille, actif) via une action contextuelle.

## Les 30 écrans du MVP

| #   | Écran                   | Route                         | Objectif unique                 | États gérés                               |
| --- | ----------------------- | ----------------------------- | ------------------------------- | ----------------------------------------- |
| 1   | Splash                  | `/splash`                     | Restaurer la session            | loading                                   |
| 2   | Welcome                 | `/welcome`                    | Comprendre la promesse          | —                                         |
| 3   | Login                   | `/login`                      | Se connecter                    | error, loading                            |
| 4   | Signup                  | `/signup`                     | Créer un compte                 | error, loading                            |
| 5   | Forgot password         | `/forgot-password`            | Recevoir un lien                | success constant                          |
| 6   | Onboarding objectif     | `/goal`                       | Choisir un objectif             | —                                         |
| 7   | Onboarding horizon      | `/horizon`                    | Choisir un horizon              | —                                         |
| 8   | Onboarding expérience   | `/experience`                 | Déclarer son niveau             | —                                         |
| 9   | Onboarding risque       | `/risk`                       | Scénario de baisse de 20 %      | mention non-réglementaire                 |
| 10  | Onboarding actifs       | `/assets`                     | Types d'actifs suivis           | —                                         |
| 11  | Onboarding portefeuille | `/portfolio`                  | Ajouter des positions           | empty, skip                               |
| 12  | Onboarding prêt         | `/ready`                      | Générer le 1er dashboard        | loading                                   |
| 13  | Dashboard               | `/(app)`                      | Comprendre sa journée           | loading (skeleton), empty, error, offline |
| 14  | Daily Brief             | `/brief/[id]`                 | Lire le brief complet           | stale, empty, error                       |
| 15  | News detail             | `/news/[id]`                  | « Pourquoi cela me concerne ? » | loading, error, IA indisponible           |
| 16  | Portfolio               | `/(app)/portfolio`            | Voir son exposition             | empty, loading, error                     |
| 17  | Asset detail            | `/asset/[id]`                 | Comprendre une ligne            | loading, error                            |
| 18  | Market Radar            | `/(app)/markets`              | Thèmes du marché                | loading, premium-gate                     |
| 19  | AI Coach                | `/coach`                      | Poser une question              | loading, quota, LLM indisponible          |
| 20  | Learning                | `/(app)/learn`                | Choisir une leçon               | loading, empty                            |
| 21  | Lesson detail           | `/lesson/[id]`                | Apprendre en 2 min + quiz       | loading, completed                        |
| 22  | Journal                 | `/journal`                    | Relire ses décisions            | empty, loading                            |
| 23  | Journal detail          | `/journal/[id]`               | « Voici ce que vous pensiez »   | loading                                   |
| 24  | Notifications           | `/notifications`              | Rattraper l'important           | empty                                     |
| 25  | Profile                 | `/(app)/profile`              | Accéder à tout le reste         | —                                         |
| 26  | Settings                | `/settings`                   | Régler l'app                    | —                                         |
| 27  | Security                | `/settings/security`          | Changer son mot de passe        | error                                     |
| 28  | Subscription            | `/settings/subscription`      | Comprendre son plan             | loading                                   |
| 29  | Delete account          | `/settings/delete-account`    | Supprimer son compte            | confirmation forte                        |
| 30  | Help / Terms / Privacy  | `/help`, `/terms`, `/privacy` | Informer                        | —                                         |

## Hiérarchie du Dashboard

```
Bonjour, {prénom} 👋            ← contexte humain, pas d'accroche marketing
Votre briefing du jour          ← résumé 3 lignes + « Lire le brief »
[Performance portefeuille]      ← valeur + variation (signe + flèche + libellé), asOf
────────────────────────────
Les marchés                     ← 7 indices, lecture horizontale
────────────────────────────
Les 5 informations importantes  ← NewsCard, avec « concerne votre portefeuille » si exposition
────────────────────────────
Pour votre portefeuille         ← analyse personnalisée (exposition dominante du jour)
────────────────────────────
À apprendre aujourd'hui         ← mini-leçon liée au thème dominant
────────────────────────────
Demander à NOVA                 ← entrée du chat
```

Règle : un écran, un objectif. Rien n'est ajouté pour remplir l'espace.
