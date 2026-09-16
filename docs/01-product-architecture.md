# A. Product architecture — NOVA

> NOVA — _Votre copilote personnel pour comprendre vos investissements._

## 1. Le problème

Un particulier qui investit doit aujourd'hui, chaque matin :

- consulter plusieurs sources d'actualité financière ;
- comprendre lesquelles sont importantes ;
- deviner ce qui concerne **son** portefeuille ;
- traduire un vocabulaire technique ;
- éviter de réagir émotionnellement.

Les applications existantes s'arrêtent à l'étape 1. Elles affichent de l'information, pas du sens.

## 2. La boucle produit

NOVA est construit autour d'une boucle unique, et chaque module du code sert cette boucle :

```
MON PROFIL          → investor_profiles      (objectif, horizon, expérience, tolérance)
MON PORTEFEUILLE    → portfolios/positions   (exposition réelle, calculée côté serveur)
CE QUI SE PASSE     → news + market_data     (faits sourcés, datés)
CE QUI EST IMPORTANT→ scoring engine         (importance déterministe, 0-100)
POURQUOI            → personalization + AI   (exposition croisée + explication)
CE QUE J'APPRENDS   → learning               (leçon 2 min contextuelle)
MES DÉCISIONS       → journal                (raison, horizon, conviction)
MON HISTORIQUE      → journal + briefs       (relecture à 6 mois)
     ↓
PERSONNALISATION DE PLUS EN PLUS PERTINENTE
```

## 3. Ce que NOVA est, et ce qu'il n'est pas

| NOVA **est**                                             | NOVA **n'est pas**                      |
| -------------------------------------------------------- | --------------------------------------- |
| Un moteur d'explication contextualisée                   | Un flux de news                         |
| Un révélateur d'exposition de portefeuille               | Un robo-advisor                         |
| Un outil pédagogique                                     | Un courtier / une plateforme de trading |
| Une couche de transparence (source + date + incertitude) | Une source de prédictions               |

Le MVP **informe, contextualise, explique, éduque**. Il ne recommande pas.

## 4. Séparation épistémique (principe structurant)

Toute information affichée porte un **type épistémique** explicite, jusque dans les types TypeScript
(`packages/types` → `EpistemicKind`) :

| Type          | Origine                                       | Rendu UI                                            |
| ------------- | --------------------------------------------- | --------------------------------------------------- |
| `fact`        | Source primaire citée (news, publication)     | Texte neutre + source + date                        |
| `data`        | Donnée structurée (prix, exposition calculée) | Valeur + `asOf` + badge `DEMO` si applicable        |
| `analysis`    | Moteur déterministe (scoring, exposition)     | Libellé + méthode explicable                        |
| `hypothesis`  | Chaîne de causalité plausible                 | Formulation conditionnelle (« peut », « pourrait ») |
| `uncertainty` | Ce que l'on ne sait pas                       | Section dédiée « Ce qu'on ne sait pas »             |
| `opinion`     | Avis externe attribué                         | Attribution obligatoire                             |

Une hypothèse n'est jamais rendue comme un fait. Cette règle est appliquée par le schéma de sortie
du LLM (`packages/validation`), pas seulement par le prompt.

## 5. Personas

**Camille, 29 ans, développeuse.** 8 000 € sur un PEA (2 ETF), débutante. Veut comprendre
pourquoi son ETF World a baissé sans y passer 1 h. Niveau de langage : simple, sans jargon.

**Thomas, 41 ans, cadre.** 60 000 € répartis actions/ETF/crypto, intermédiaire. Veut savoir
quelle part de son portefeuille est exposée aux taux US et pourquoi une décision de la BCE compte.

Le produit sert les deux via le toggle **Simple / Détaillé** et l'adaptation au `experienceLevel`.

## 6. Parcours cœur (matin, 3 minutes)

1. Ouverture → Dashboard : salutation, performance portefeuille (avec `asOf`), marchés.
2. « Les 5 informations importantes » — triées par `importanceScore` **et** `portfolioRelevanceScore`.
3. Tap sur une news → « Pourquoi cela vous concerne ? » : faits, contexte, actifs concernés,
   **votre exposition chiffrée**, explication personnalisée, incertitudes, sources.
4. « À apprendre aujourd'hui » : leçon 2 min liée au thème dominant du jour.
5. « Demander à NOVA » : question libre, réponse structurée et sourcée.
6. Optionnel : entrée de journal (« pourquoi j'ai acheté / je n'ai rien fait »).

## 7. Modules produit du MVP

| #   | Module                                  | Statut MVP                   | Plan                    |
| --- | --------------------------------------- | ---------------------------- | ----------------------- |
| 1   | Landing / Welcome                       | ✅                           | free                    |
| 2   | Auth (register/login/refresh/reset)     | ✅                           | free                    |
| 3   | Onboarding investisseur (8 étapes)      | ✅                           | free                    |
| 4   | Profil utilisateur                      | ✅                           | free                    |
| 5   | Portefeuille manuel                     | ✅                           | free                    |
| 6   | Dashboard personnalisé                  | ✅                           | free                    |
| 7   | Daily Brief                             | ✅ (limité en free)          | free / premium          |
| 8   | Actualités                              | ✅                           | free                    |
| 9   | « Pourquoi cela vous concerne ? »       | ✅                           | free (quota) / premium  |
| 10  | Market Radar                            | ✅                           | premium                 |
| 11  | AI Coach                                | ✅ (quota free)              | premium                 |
| 12  | Learning                                | ✅                           | free (basique)          |
| 13  | Journal                                 | ✅                           | free / premium (avancé) |
| 14  | Notifications                           | ✅                           | free                    |
| 15  | Paramètres & suppression de compte      | ✅                           | free                    |
| 16  | États loading / empty / error / offline | ✅                           | —                       |
| 17  | Architecture données de marché réelles  | ✅ (interfaces + demo)       | —                       |
| 18  | Architecture broker future              | ✅ (interface + non activée) | V2                      |

Hors MVP, explicitement : trading, robo-advisor, connexion broker réelle, recommandation personnalisée.

## 8. Garde-fous produit

- Aucun bouton d'achat/vente, aucun appel à l'action transactionnel.
- Pas de compteur anxiogène, pas d'urgence artificielle, pas de notification « le marché s'effondre ».
- Les variations ne dépendent jamais uniquement de la couleur (signe + flèche + libellé).
- Le score d'importance n'est jamais présenté comme une prévision de performance.
- Toute donnée non réelle est étiquetée `DEMO DATA` dans l'API **et** dans l'UI.

## 9. Critères de réussite du MVP

Le parcours complet est fonctionnel de bout en bout :
`signup → onboarding → portefeuille → position → exposition → brief → news → « pourquoi » →
question à NOVA → leçon → journal → paramètres → logout → suppression de compte`,
chaque étape dégradant proprement en cas d'erreur réseau, d'API indisponible ou de LLM indisponible.
