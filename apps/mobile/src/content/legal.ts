/**
 * Legal copy shipped with the app.
 *
 * Written for a French/EU retail audience. These texts describe what NOVA actually does in
 * this codebase — they are a starting point for legal review, not a substitute for it, and the
 * app states that plainly rather than implying validated terms.
 */
export const TERMS_SECTIONS = [
  {
    heading: 'Objet du service',
    body: "NOVA est un service d'information et de pédagogie financière. NOVA agrège des actualités et des données de marché, les met en relation avec le portefeuille que vous renseignez, et vous fournit des explications contextuelles.",
  },
  {
    heading: 'Ce que NOVA ne fait pas',
    body: "NOVA ne fournit pas de conseil en investissement personnalisé, ne recommande aucun achat ou vente, n'exécute aucune transaction et n'a accès à aucun compte titres. NOVA ne gère pas votre argent.",
  },
  {
    heading: 'Données affichées',
    body: "Lorsque les données de marché ou d'actualité proviennent d'un jeu de démonstration, elles sont explicitement identifiées par la mention DEMO DATA. Les performances passées ne préjugent pas des performances futures.",
  },
  {
    heading: 'Votre compte',
    body: 'Vous êtes responsable de la confidentialité de vos identifiants. Vous pouvez à tout moment exporter vos données ou supprimer votre compte depuis les paramètres.',
  },
  {
    heading: 'Limites de responsabilité',
    body: "Les décisions d'investissement vous appartiennent. NOVA met en œuvre des moyens raisonnables pour fournir une information exacte et sourcée, sans garantir l'exhaustivité ou l'exactitude des données fournies par des tiers.",
  },
  {
    heading: 'Évolution du service',
    body: "Certaines fonctionnalités futures pourront relever d'un cadre réglementaire spécifique. Elles ne seront activées qu'après les validations nécessaires.",
  },
];

export const PRIVACY_SECTIONS = [
  {
    heading: 'Données que nous collectons',
    body: 'Votre adresse e-mail et votre prénom, votre profil investisseur (objectif, horizon, expérience, tolérance aux fluctuations), les positions que vous saisissez, vos entrées de journal, votre progression pédagogique et vos préférences.',
  },
  {
    heading: 'Pourquoi nous les collectons',
    body: "Uniquement pour faire fonctionner le produit : personnaliser votre briefing, calculer votre exposition, adapter les explications à votre niveau. Aucune donnée n'est vendue.",
  },
  {
    heading: 'Minimisation',
    body: "Le montant exact de votre portefeuille n'est jamais transmis à un service tiers. Lorsque NOVA sollicite un modèle de langage pour rédiger une explication, il ne reçoit que des pourcentages d'exposition et une tranche de valeur, jamais votre identité ni vos montants exacts.",
  },
  {
    heading: 'Analytics',
    body: "Nous mesurons uniquement des événements produit (par exemple : briefing ouvert, leçon terminée). Aucun montant, aucune position et aucune identité ne sont envoyés à un outil d'analytics.",
  },
  {
    heading: 'Conservation et suppression',
    body: "La suppression de votre compte anonymise immédiatement vos données personnelles, puis les efface définitivement à l'issue de la période de conservation. Vous pouvez exporter l'ensemble de vos données au format JSON à tout moment.",
  },
  {
    heading: 'Sécurité',
    body: "Les mots de passe sont stockés sous forme d'empreintes calculées avec scrypt. Les échanges sont chiffrés en transit. Les accès sensibles sont journalisés sans jamais contenir de mot de passe, de jeton ni de montant.",
  },
  {
    heading: 'Vos droits',
    body: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité. L'export et la suppression sont accessibles directement dans l'application.",
  },
];

export const HELP_SECTIONS = [
  {
    heading: 'Comment NOVA choisit les actualités ?',
    body: "Un moteur déterministe attribue à chaque information un score d'importance (catégorie, portée, fraîcheur, ampleur) et un score de confiance (qualité de la source, formulation). NOVA croise ensuite ce classement avec votre exposition réelle. Un score est une priorité de lecture, jamais une prévision de performance.",
  },
  {
    heading: 'D’où viennent les chiffres ?',
    body: "Des données de marché stockées par NOVA, avec leur date. Quand elles proviennent du jeu de démonstration, la mention DEMO DATA est affichée. Aucun chiffre n'est produit par l'intelligence artificielle.",
  },
  {
    heading: 'Que fait exactement l’IA ?',
    body: 'Elle rédige les explications à partir de données déjà calculées par NOVA. Elle ne décide pas de ce qui est important, ne consulte pas Internet et ne peut pas citer une source qui ne lui a pas été fournie. Si sa réponse ne respecte pas ce cadre, NOVA la remplace par une explication produite directement à partir de vos données.',
  },
  {
    heading: 'Mon portefeuille est-il connecté à ma banque ?',
    body: "Non. Vous saisissez vos positions manuellement. NOVA n'a accès à aucun compte et ne peut passer aucun ordre.",
  },
  {
    heading: 'Comment supprimer mon compte ?',
    body: 'Profil → Paramètres → Supprimer mon compte. La suppression demande votre mot de passe et une confirmation explicite.',
  },
];
