/**
 * Financial glossary.
 *
 * Definitions are written and reviewed by humans, not produced by a model: when a user asks
 * "qu'est-ce qu'un ETF ?", the answer comes from here. This is the primary source in the
 * chain Source → Data → Engine → AI → Explanation (rule #59).
 */
export interface GlossaryEntry {
  key: string;
  term: string;
  aliases: string[];
  simple: string;
  detailed: string;
  whyItMatters: string;
  uncertainties: string[];
  relatedLessonSlug: string | null;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    key: 'etf',
    term: 'ETF',
    aliases: ['etf', 'tracker', 'fonds indiciel', 'fonds indiciels'],
    simple:
      'Un ETF est un fonds coté en bourse qui suit un indice. En achetant une part, vous détenez indirectement une petite fraction de toutes les entreprises de cet indice.',
    detailed:
      'Un ETF (Exchange Traded Fund) réplique la performance d’un indice, soit en détenant réellement les titres qui le composent (réplication physique), soit via un contrat d’échange avec une contrepartie (réplication synthétique). Il s’achète et se vend en bourse comme une action. Ses frais annuels de gestion, exprimés en pourcentage des encours, sont prélevés en continu sur la valeur de la part.',
    whyItMatters:
      'Un ETF permet d’être exposé à un grand nombre d’entreprises avec une seule ligne, ce qui réduit le risque lié à une société en particulier — mais pas le risque du marché dans son ensemble.',
    uncertainties: [
      'La performance future d’un indice n’est pas connue à l’avance.',
      'Deux ETF suivant le même indice peuvent avoir des frais et une fiscalité différents.',
    ],
    relatedLessonSlug: 'comprendre-les-etf',
  },
  {
    key: 'diversification',
    term: 'Diversification',
    aliases: ['diversification', 'diversifier', 'diversifié'],
    simple:
      'Diversifier, c’est répartir son argent entre plusieurs placements différents pour qu’un seul événement ne pèse pas trop sur l’ensemble.',
    detailed:
      'La diversification réduit le risque spécifique, celui qui est propre à une entreprise ou à un secteur. Elle ne supprime pas le risque de marché, qui touche l’ensemble des actifs en même temps. Son efficacité dépend du degré de corrélation entre les actifs détenus : deux actions du même secteur évoluent souvent ensemble.',
    whyItMatters:
      'Une concentration élevée signifie qu’une seule information peut avoir un effet important sur la valeur totale de votre portefeuille.',
    uncertainties: [
      'Les corrélations entre actifs varient dans le temps, en particulier lors des périodes de tension.',
    ],
    relatedLessonSlug: 'la-diversification',
  },
  {
    key: 'volatility',
    term: 'Volatilité',
    aliases: ['volatilité', 'volatilite', 'volatil'],
    simple:
      'La volatilité mesure l’ampleur des variations de prix d’un actif. Plus elle est élevée, plus les hausses et les baisses sont marquées.',
    detailed:
      'La volatilité est l’écart-type des variations de prix sur une période donnée, souvent annualisé. Elle décrit l’amplitude des mouvements passés, dans les deux sens. Ce n’est pas une mesure de la probabilité de perdre de l’argent, ni une prévision.',
    whyItMatters:
      'Un actif très volatil peut faire varier fortement la valeur quotidienne de votre portefeuille, même si votre horizon d’investissement est long.',
    uncertainties: ['La volatilité passée ne détermine pas la volatilité future.'],
    relatedLessonSlug: 'la-volatilite',
  },
  {
    key: 'inflation',
    term: 'Inflation',
    aliases: ['inflation', 'prix à la consommation', 'hausse des prix'],
    simple:
      'L’inflation est la hausse générale des prix. Avec 2 % d’inflation, ce qui coûtait 100 € coûte 102 € un an plus tard.',
    detailed:
      'L’inflation est mesurée par l’évolution d’un panier de biens et services représentatif de la consommation des ménages. L’inflation sous-jacente exclut l’énergie et l’alimentation, plus volatiles, pour observer la tendance de fond. Les banques centrales ajustent leur politique monétaire en fonction de cette trajectoire.',
    whyItMatters:
      'L’inflation réduit le pouvoir d’achat de l’épargne non investie et influence les décisions de taux, qui affectent la valorisation de nombreux actifs.',
    uncertainties: [
      'La trajectoire future de l’inflation dépend de facteurs multiples, dont l’énergie et les salaires.',
    ],
    relatedLessonSlug: 'inflation-et-epargne',
  },
  {
    key: 'interest_rates',
    term: 'Taux d’intérêt',
    aliases: ['taux', 'taux d’intérêt', "taux d'interet", 'taux directeur', 'bce', 'fed'],
    simple:
      'Le taux d’intérêt est le prix de l’argent emprunté. Quand les banques centrales relèvent leurs taux, emprunter coûte plus cher.',
    detailed:
      'Les banques centrales fixent des taux directeurs qui se répercutent sur le coût du crédit, le rendement des obligations nouvellement émises et, par ricochet, sur la valorisation des actifs. Une hausse des taux tend à faire baisser le prix des obligations déjà émises, dont le rendement devient moins attractif, et pèse davantage sur les entreprises dont les bénéfices sont attendus loin dans le futur.',
    whyItMatters:
      'Les taux influencent presque toutes les classes d’actifs : obligations, actions, immobilier, et le coût de vos propres emprunts.',
    uncertainties: [
      'Les décisions futures des banques centrales ne sont pas connues à l’avance.',
      'L’ampleur et le délai de transmission des taux à l’économie varient.',
    ],
    relatedLessonSlug: 'comprendre-les-taux',
  },
  {
    key: 'bonds',
    term: 'Obligations',
    aliases: ['obligation', 'obligations', 'obligataire'],
    simple:
      'Une obligation est un prêt que vous accordez à un État ou à une entreprise, qui vous verse des intérêts puis vous rembourse à l’échéance.',
    detailed:
      'Le prix d’une obligation déjà émise évolue en sens inverse des taux d’intérêt. La duration mesure la sensibilité de ce prix à une variation des taux : plus elle est élevée, plus le prix bouge. S’ajoute le risque de crédit, c’est-à-dire la capacité de l’émetteur à rembourser.',
    whyItMatters:
      'Les obligations occupent souvent une place stabilisatrice dans un portefeuille, mais elles ne sont pas sans risque.',
    uncertainties: [
      'Le comportement futur des taux et la qualité de crédit des émetteurs peuvent changer.',
    ],
    relatedLessonSlug: 'les-obligations',
  },
  {
    key: 'compounding',
    term: 'Capitalisation',
    aliases: ['capitalisation', 'intérêts composés', 'interets composes'],
    simple:
      'La capitalisation, ce sont les gains qui produisent eux-mêmes des gains : vos intérêts s’ajoutent au capital et rapportent à leur tour.',
    detailed:
      'Avec un rendement annuel r sur n années, un capital C devient C × (1 + r)^n. L’effet est faible les premières années puis s’accentue avec le temps, ce qui rend la durée d’investissement déterminante. Les frais se composent de la même manière, en sens inverse.',
    whyItMatters:
      'La durée pendant laquelle vous restez investi a souvent plus d’effet que le choix du point d’entrée.',
    uncertainties: [
      'Le rendement futur est inconnu ; la formule suppose un rendement constant, ce qui n’arrive pas.',
    ],
    relatedLessonSlug: 'les-interets-composes',
  },
  {
    key: 'risk',
    term: 'Risque',
    aliases: ['risque', 'risqué'],
    simple:
      'En investissement, le risque est la possibilité que la valeur de votre placement baisse, temporairement ou durablement.',
    detailed:
      'On distingue le risque de marché (l’ensemble baisse), le risque spécifique (une entreprise en particulier), le risque de change, le risque de liquidité et le risque de crédit. Le risque ne se supprime pas ; il se répartit, se mesure et se met en regard de son horizon de placement.',
    whyItMatters:
      'Comprendre quel risque vous prenez évite les décisions précipitées lors d’une baisse.',
    uncertainties: ['Aucune mesure de risque ne capture tous les scénarios possibles.'],
    relatedLessonSlug: 'comprendre-le-risque',
  },
  {
    key: 'valuation',
    term: 'Valorisation',
    aliases: ['valorisation', 'per', 'price earnings', 'cher', 'valorisé'],
    simple:
      'La valorisation compare le prix d’une entreprise à ce qu’elle gagne. Elle aide à situer un prix, sans dire s’il va monter ou baisser.',
    detailed:
      'Le PER (cours / bénéfice par action) est l’indicateur le plus courant. Un PER élevé signifie que le marché anticipe une forte croissance des bénéfices — anticipation qui peut se vérifier ou non. La valorisation se compare entre entreprises d’un même secteur et dans le temps.',
    whyItMatters:
      'Une valorisation élevée rend le cours plus sensible à une déception sur les résultats.',
    uncertainties: ['Les bénéfices futurs sont des estimations, pas des faits.'],
    relatedLessonSlug: 'la-valorisation',
  },
  {
    key: 'real_return',
    term: 'Rendement réel',
    aliases: ['rendement réel', 'rendement reel', 'rendement net d’inflation'],
    simple:
      'Le rendement réel, c’est ce qu’il reste de votre rendement une fois l’inflation déduite.',
    detailed:
      'Approximativement, rendement réel ≈ rendement nominal − inflation. Un placement à 3 % dans une économie à 2 % d’inflation procure environ 1 % de pouvoir d’achat supplémentaire, avant frais et fiscalité.',
    whyItMatters:
      'Un rendement nominal positif peut cacher une perte de pouvoir d’achat si l’inflation est plus élevée.',
    uncertainties: ['L’inflation future et la fiscalité applicable peuvent évoluer.'],
    relatedLessonSlug: 'inflation-et-epargne',
  },
  {
    key: 'currency_risk',
    term: 'Risque de change',
    aliases: ['change', 'devise', 'dollar', 'risque de change'],
    simple:
      'Si vous détenez un actif en dollars, sa valeur en euros dépend aussi du taux de change euro-dollar.',
    detailed:
      'Pour un investisseur de la zone euro, la performance d’un actif libellé en devise étrangère combine la performance propre de l’actif et la variation de la devise. Certains fonds sont « couverts » contre ce risque, ce qui a un coût.',
    whyItMatters:
      'Une part importante de votre portefeuille peut être exposée au dollar sans que ce soit visible au premier regard.',
    uncertainties: ['L’évolution future des taux de change n’est pas prévisible.'],
    relatedLessonSlug: 'le-risque-de-change',
  },
  {
    key: 'dividend',
    term: 'Dividende',
    aliases: ['dividende', 'dividendes', 'revenus'],
    simple: 'Un dividende est une part du bénéfice qu’une entreprise verse à ses actionnaires.',
    detailed:
      'Le versement d’un dividende réduit mécaniquement le cours de l’action du même montant le jour du détachement. Un rendement du dividende élevé peut refléter une politique de distribution généreuse comme un cours qui a beaucoup baissé.',
    whyItMatters:
      'Les dividendes ne sont ni garantis ni obligatoires : une entreprise peut les réduire ou les suspendre.',
    uncertainties: [
      'Le niveau futur des dividendes dépend des résultats et des décisions de l’entreprise.',
    ],
    relatedLessonSlug: null,
  },
];

const NORMALIZE = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Finds the glossary entry a free-text question is about, if any. */
export function findGlossaryEntry(question: string): GlossaryEntry | null {
  const haystack = NORMALIZE(question);
  let best: { entry: GlossaryEntry; length: number } | null = null;

  for (const entry of GLOSSARY) {
    for (const alias of [entry.term, ...entry.aliases]) {
      const needle = NORMALIZE(alias);
      if (!needle) continue;
      // Word-boundary match so "or" inside "important" does not trigger a false positive.
      const pattern = new RegExp(
        `(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`,
      );
      if (pattern.test(haystack) && (!best || needle.length > best.length)) {
        best = { entry, length: needle.length };
      }
    }
  }
  return best?.entry ?? null;
}
