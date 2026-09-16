/**
 * Authored learning content.
 *
 * Written for a French retail investor, reviewed as code. Each lesson is ~2 minutes, ends with
 * takeaways and a short quiz whose correct answers stay server-side.
 */
export interface SeedLesson {
  slug: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  category: string;
  themeKeys: string[];
  orderIndex: number;
  content: {
    sections: { heading: string; body: string }[];
    keyTakeaways: string[];
    glossary: { term: string; definition: string }[];
    quiz: {
      id: string;
      question: string;
      options: { id: string; label: string }[];
      correctOptionId: string;
      explanation: string;
    }[];
  };
}

export const SEED_LESSONS: SeedLesson[] = [
  {
    slug: 'comprendre-les-etf',
    title: 'Comprendre les ETF',
    description: 'Ce qu’est un ETF, ce qu’il contient, et ce qu’il ne garantit pas.',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'Produits',
    themeKeys: ['technology', 'rates'],
    orderIndex: 1,
    content: {
      sections: [
        {
          heading: 'Un panier, pas une action',
          body: 'Un ETF est un fonds coté en bourse qui suit un indice, par exemple le CAC 40 ou le MSCI World. En achetant une part, vous détenez indirectement une petite fraction de toutes les entreprises de cet indice. Vous n’achetez donc pas une société, mais un panier.',
        },
        {
          heading: 'Pourquoi c’est utile',
          body: 'Avec une seule ligne, vous réduisez le risque lié à une entreprise en particulier : si l’une d’elles traverse une mauvaise passe, son poids dans l’indice limite l’effet sur votre investissement. En revanche, si l’ensemble du marché baisse, votre ETF baisse aussi : la diversification ne protège pas du risque de marché.',
        },
        {
          heading: 'Ce à quoi regarder',
          body: 'Trois éléments concrets : l’indice suivi (ce que vous achetez réellement), les frais annuels de gestion (prélevés en continu, même quand le marché baisse), et l’enveloppe fiscale dans laquelle vous le détenez. Deux ETF sur le même indice peuvent avoir des frais différents.',
        },
      ],
      keyTakeaways: [
        'Un ETF suit un indice : vous achetez un panier, pas une entreprise.',
        'Il réduit le risque propre à une société, pas le risque du marché.',
        'Les frais annuels sont prélevés quelle que soit la performance.',
      ],
      glossary: [
        { term: 'Indice', definition: 'Un panier d’entreprises représentatif d’un marché ou d’un secteur.' },
        { term: 'Frais de gestion', definition: 'Pourcentage annuel prélevé par l’émetteur sur l’encours du fonds.' },
      ],
      quiz: [
        {
          id: 'etf-q1',
          question: 'En achetant une part d’ETF MSCI World, vous détenez :',
          options: [
            { id: 'a', label: 'Une action d’une grande entreprise mondiale' },
            { id: 'b', label: 'Une fraction de toutes les entreprises de l’indice' },
            { id: 'c', label: 'Une obligation émise par un État' },
          ],
          correctOptionId: 'b',
          explanation:
            'Un ETF réplique un indice : votre part représente une petite fraction de l’ensemble des sociétés qui le composent.',
        },
        {
          id: 'etf-q2',
          question: 'Un ETF protège-t-il d’une baisse générale des marchés ?',
          options: [
            { id: 'a', label: 'Oui, c’est son rôle' },
            { id: 'b', label: 'Non : il suit l’indice, à la hausse comme à la baisse' },
          ],
          correctOptionId: 'b',
          explanation:
            'La diversification réduit le risque lié à une entreprise, pas celui d’un recul de l’ensemble du marché.',
        },
      ],
    },
  },
  {
    slug: 'la-diversification',
    title: 'La diversification',
    description: 'Pourquoi répartir, et ce que la répartition ne peut pas faire.',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'Principes',
    themeKeys: ['rates', 'geopolitics'],
    orderIndex: 2,
    content: {
      sections: [
        {
          heading: 'L’idée',
          body: 'Diversifier, c’est répartir son argent entre plusieurs placements pour qu’un seul événement ne pèse pas trop sur l’ensemble. Si une entreprise déçoit et qu’elle représente 3 % de votre portefeuille, l’effet reste mesuré. Si elle en représente 40 %, c’est une autre histoire.',
        },
        {
          heading: 'Diversifier sur quoi ?',
          body: 'Sur les entreprises, mais aussi sur les secteurs, les zones géographiques, les devises et les types d’actifs. Détenir dix sociétés technologiques américaines est moins diversifié qu’il n’y paraît : elles réagissent souvent aux mêmes informations.',
        },
        {
          heading: 'Les limites',
          body: 'La diversification ne supprime pas le risque de marché. Lors des périodes de tension, les actifs ont tendance à baisser ensemble : les corrélations augmentent au moment précis où l’on aurait besoin qu’elles diminuent.',
        },
      ],
      keyTakeaways: [
        'Diversifier limite l’effet d’un événement isolé.',
        'La vraie diversification porte aussi sur les secteurs, les zones et les devises.',
        'Elle ne protège pas d’une baisse générale des marchés.',
      ],
      glossary: [
        { term: 'Corrélation', definition: 'Tendance de deux actifs à évoluer dans le même sens.' },
        { term: 'Concentration', definition: 'Part du portefeuille investie sur une seule ligne.' },
      ],
      quiz: [
        {
          id: 'div-q1',
          question: 'Un portefeuille composé de dix valeurs technologiques américaines est :',
          options: [
            { id: 'a', label: 'Bien diversifié : dix entreprises différentes' },
            { id: 'b', label: 'Peu diversifié : même secteur, même zone, mêmes facteurs' },
          ],
          correctOptionId: 'b',
          explanation:
            'Le nombre de lignes ne suffit pas : ces sociétés réagissent largement aux mêmes informations.',
        },
      ],
    },
  },
  {
    slug: 'la-volatilite',
    title: 'La volatilité',
    description: 'Ce que mesure la volatilité, et ce qu’elle ne prédit pas.',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'Risque',
    themeKeys: ['technology', 'commodities'],
    orderIndex: 3,
    content: {
      sections: [
        {
          heading: 'Une mesure d’amplitude',
          body: 'La volatilité mesure l’ampleur des variations de prix d’un actif, dans les deux sens. Un actif volatil monte et descend fortement ; un actif peu volatil bouge lentement.',
        },
        {
          heading: 'Ce n’est pas le risque de perte',
          body: 'Une forte volatilité n’implique pas une perte : elle décrit l’amplitude des mouvements passés. Un actif peut être très volatil et progresser sur la durée, ou peu volatil et perdre régulièrement de la valeur.',
        },
        {
          heading: 'Pourquoi cela compte pour vous',
          body: 'La volatilité détermine surtout votre confort : c’est elle qui rend une baisse difficile à traverser. Connaître la volatilité de son portefeuille, c’est anticiper sa propre réaction avant que la baisse arrive.',
        },
      ],
      keyTakeaways: [
        'La volatilité mesure l’amplitude des variations, pas la probabilité de perdre.',
        'Elle décrit le passé et ne prédit pas le futur.',
        'Elle influence surtout votre capacité à rester investi.',
      ],
      glossary: [
        { term: 'Écart-type', definition: 'Mesure statistique de la dispersion des variations autour de leur moyenne.' },
      ],
      quiz: [
        {
          id: 'vol-q1',
          question: 'Une volatilité élevée signifie :',
          options: [
            { id: 'a', label: 'Que l’actif va probablement baisser' },
            { id: 'b', label: 'Que les variations, à la hausse comme à la baisse, sont amples' },
          ],
          correctOptionId: 'b',
          explanation: 'La volatilité est une mesure d’amplitude, sans direction.',
        },
      ],
    },
  },
  {
    slug: 'comprendre-les-taux',
    title: 'Comprendre les taux d’intérêt',
    description: 'Comment une décision de banque centrale finit par toucher votre portefeuille.',
    difficulty: 'intermediate',
    estimatedMinutes: 3,
    category: 'Macroéconomie',
    themeKeys: ['rates', 'bonds', 'banks', 'inflation'],
    orderIndex: 4,
    content: {
      sections: [
        {
          heading: 'Le prix de l’argent',
          body: 'Le taux d’intérêt est le prix de l’argent emprunté. Les banques centrales fixent des taux directeurs qui se diffusent au crédit immobilier, au financement des entreprises et au rendement des obligations nouvellement émises.',
        },
        {
          heading: 'Effet sur les obligations',
          body: 'Quand les taux montent, les obligations déjà émises deviennent moins attractives : leur prix baisse pour compenser. Plus leur échéance est lointaine (leur duration est élevée), plus cet effet est marqué.',
        },
        {
          heading: 'Effet sur les actions',
          body: 'Des taux plus élevés pèsent davantage sur les entreprises dont les bénéfices sont attendus loin dans le futur, car ces bénéfices « valent » moins une fois actualisés. C’est une explication courante des mouvements du secteur technologique lors des changements de taux — une explication, pas une loi.',
        },
      ],
      keyTakeaways: [
        'Les taux directeurs se diffusent à l’ensemble de l’économie.',
        'Hausse des taux → baisse du prix des obligations déjà émises.',
        'Les entreprises de croissance y sont structurellement plus sensibles.',
      ],
      glossary: [
        { term: 'Taux directeur', definition: 'Taux fixé par une banque centrale, référence du coût de l’argent.' },
        { term: 'Duration', definition: 'Sensibilité du prix d’une obligation à une variation des taux.' },
      ],
      quiz: [
        {
          id: 'rates-q1',
          question: 'Les taux montent. Que se passe-t-il, mécaniquement, pour une obligation déjà émise ?',
          options: [
            { id: 'a', label: 'Son prix a tendance à baisser' },
            { id: 'b', label: 'Son prix a tendance à monter' },
            { id: 'c', label: 'Son prix ne bouge pas' },
          ],
          correctOptionId: 'a',
          explanation:
            'Les nouvelles obligations offrent un meilleur rendement : le prix des anciennes s’ajuste à la baisse.',
        },
      ],
    },
  },
  {
    slug: 'inflation-et-epargne',
    title: 'Inflation et pouvoir d’achat de l’épargne',
    description: 'Pourquoi un rendement positif peut cacher une perte réelle.',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'Macroéconomie',
    themeKeys: ['inflation', 'rates'],
    orderIndex: 5,
    content: {
      sections: [
        {
          heading: 'Ce que mesure l’inflation',
          body: 'L’inflation est la hausse générale des prix. À 2 % par an, ce qui coûte 100 € aujourd’hui coûtera environ 102 € dans un an.',
        },
        {
          heading: 'Rendement nominal et rendement réel',
          body: 'Le rendement réel, c’est le rendement affiché moins l’inflation. Un placement à 3 % dans une économie à 2 % d’inflation vous apporte environ 1 % de pouvoir d’achat en plus, avant frais et fiscalité.',
        },
        {
          heading: 'La conséquence pratique',
          body: 'De l’argent laissé sans rendement perd du pouvoir d’achat chaque année où les prix augmentent. Ce n’est pas une raison d’investir précipitamment : c’est une raison de savoir ce que fait votre épargne.',
        },
      ],
      keyTakeaways: [
        'Rendement réel ≈ rendement nominal − inflation.',
        'Un rendement positif peut masquer une perte de pouvoir d’achat.',
        'L’inflation future est incertaine.',
      ],
      glossary: [
        { term: 'Pouvoir d’achat', definition: 'Quantité de biens et services que permet d’acheter une somme donnée.' },
      ],
      quiz: [
        {
          id: 'infl-q1',
          question: 'Placement à 2 %, inflation à 3 %. Votre pouvoir d’achat :',
          options: [
            { id: 'a', label: 'Augmente de 2 %' },
            { id: 'b', label: 'Diminue d’environ 1 %' },
            { id: 'c', label: 'Reste identique' },
          ],
          correctOptionId: 'b',
          explanation: 'Le rendement réel est négatif : 2 % − 3 % ≈ −1 %.',
        },
      ],
    },
  },
  {
    slug: 'les-obligations',
    title: 'Les obligations',
    description: 'Prêter à un État ou à une entreprise : mécanique et risques.',
    difficulty: 'intermediate',
    estimatedMinutes: 3,
    category: 'Produits',
    themeKeys: ['bonds', 'rates'],
    orderIndex: 6,
    content: {
      sections: [
        {
          heading: 'Un prêt, pas une part',
          body: 'En achetant une obligation, vous prêtez de l’argent à un émetteur — un État ou une entreprise — qui s’engage à vous verser des intérêts puis à vous rembourser à l’échéance. Vous n’êtes pas propriétaire d’une part de l’entreprise.',
        },
        {
          heading: 'Deux risques principaux',
          body: 'Le risque de taux : si les taux montent, le prix de votre obligation baisse avant l’échéance. Le risque de crédit : l’émetteur peut ne pas rembourser. Une obligation d’État de la zone euro et une obligation d’entreprise fragile ne portent pas le même risque.',
        },
        {
          heading: 'Dans un portefeuille',
          body: 'Les obligations sont souvent décrites comme stabilisatrices, car elles fluctuent généralement moins que les actions. « Généralement » n’est pas « toujours » : 2022 a rappelé que les deux peuvent baisser ensemble.',
        },
      ],
      keyTakeaways: [
        'Une obligation est un prêt avec intérêts et échéance.',
        'Elle porte un risque de taux et un risque de crédit.',
        'Sa stabilité relative n’est pas une garantie.',
      ],
      glossary: [
        { term: 'Coupon', definition: 'Intérêt versé périodiquement par l’émetteur.' },
        { term: 'Risque de crédit', definition: 'Risque que l’émetteur ne rembourse pas.' },
      ],
      quiz: [
        {
          id: 'bond-q1',
          question: 'Détenir une obligation, c’est :',
          options: [
            { id: 'a', label: 'Être actionnaire de l’émetteur' },
            { id: 'b', label: 'Être créancier de l’émetteur' },
          ],
          correctOptionId: 'b',
          explanation: 'Vous prêtez de l’argent : vous êtes créancier, pas propriétaire.',
        },
      ],
    },
  },
  {
    slug: 'les-interets-composes',
    title: 'Les intérêts composés',
    description: 'Pourquoi la durée compte souvent plus que le point d’entrée.',
    difficulty: 'beginner',
    estimatedMinutes: 2,
    category: 'Principes',
    themeKeys: [],
    orderIndex: 7,
    content: {
      sections: [
        {
          heading: 'Les gains produisent des gains',
          body: 'Avec la capitalisation, vos intérêts s’ajoutent au capital et produisent à leur tour des intérêts. 1 000 € à 5 % par an deviennent 1 050 € après un an, puis 1 102,50 € après deux ans : les 2,50 € supplémentaires proviennent des intérêts de la première année.',
        },
        {
          heading: 'L’effet du temps',
          body: 'L’effet est discret les premières années puis s’accentue. C’est ce qui rend la durée d’investissement déterminante, souvent davantage que le moment exact de l’entrée.',
        },
        {
          heading: 'Le même mécanisme joue contre vous',
          body: 'Les frais se composent aussi. 1 % de frais annuels sur vingt ans représente une part significative du capital final — ce qui rend l’attention aux frais concrète plutôt que théorique.',
        },
      ],
      keyTakeaways: [
        'Les intérêts composés récompensent la durée, pas le timing.',
        'L’effet s’accélère avec le temps.',
        'Les frais se composent exactement de la même manière.',
      ],
      glossary: [
        { term: 'Capitalisation', definition: 'Réinvestissement des gains, qui produisent eux-mêmes des gains.' },
      ],
      quiz: [
        {
          id: 'comp-q1',
          question: 'Ce qui compte le plus dans l’effet des intérêts composés :',
          options: [
            { id: 'a', label: 'Le moment exact de l’achat' },
            { id: 'b', label: 'La durée pendant laquelle on reste investi' },
          ],
          correctOptionId: 'b',
          explanation: 'L’effet s’accentue avec le temps ; la durée pèse davantage que le point d’entrée.',
        },
      ],
    },
  },
  {
    slug: 'comprendre-le-risque',
    title: 'Comprendre le risque',
    description: 'Les différents risques, et comment situer le vôtre.',
    difficulty: 'intermediate',
    estimatedMinutes: 3,
    category: 'Risque',
    themeKeys: ['geopolitics', 'currencies'],
    orderIndex: 8,
    content: {
      sections: [
        {
          heading: 'Il n’y a pas un risque, mais des risques',
          body: 'Risque de marché (l’ensemble baisse), risque spécifique (une entreprise), risque de change (la devise), risque de liquidité (vendre au moment voulu), risque de crédit (l’émetteur ne rembourse pas). Ils ne se traitent pas de la même façon.',
        },
        {
          heading: 'Risque et horizon',
          body: 'Le même placement n’a pas le même sens selon que vous en avez besoin dans un an ou dans vingt. L’horizon n’élimine pas le risque, mais il change votre capacité à traverser une baisse sans vendre.',
        },
        {
          heading: 'Le risque que l’on oublie',
          body: 'Le risque comportemental : vendre au plus bas parce que la baisse était plus inconfortable que prévu. C’est le risque que le questionnaire d’onboarding de NOVA cherche à vous faire anticiper.',
        },
      ],
      keyTakeaways: [
        'Plusieurs risques coexistent et ne se gèrent pas de la même manière.',
        'L’horizon change votre capacité à supporter une baisse.',
        'Le risque comportemental est souvent le plus coûteux.',
      ],
      glossary: [
        { term: 'Risque spécifique', definition: 'Risque propre à une entreprise ou à un secteur.' },
        { term: 'Liquidité', definition: 'Facilité à vendre un actif rapidement sans décote importante.' },
      ],
      quiz: [
        {
          id: 'risk-q1',
          question: 'La diversification réduit surtout :',
          options: [
            { id: 'a', label: 'Le risque de marché' },
            { id: 'b', label: 'Le risque spécifique à une entreprise' },
          ],
          correctOptionId: 'b',
          explanation: 'Le risque de marché touche l’ensemble des actifs et ne se diversifie pas.',
        },
      ],
    },
  },
  {
    slug: 'la-valorisation',
    title: 'La valorisation',
    description: 'Ce que veut dire « cher » pour une action.',
    difficulty: 'advanced',
    estimatedMinutes: 3,
    category: 'Analyse',
    themeKeys: ['technology'],
    orderIndex: 9,
    content: {
      sections: [
        {
          heading: 'Comparer un prix à des bénéfices',
          body: 'Le PER rapporte le cours d’une action au bénéfice par action. Un PER de 25 signifie que vous payez 25 fois le bénéfice annuel. C’est une façon de situer un prix, pas de prédire son évolution.',
        },
        {
          heading: 'Un PER élevé n’est pas une erreur',
          body: 'Il traduit une anticipation de croissance des bénéfices. Cette anticipation peut se vérifier ou non — c’est précisément ce qui rend ces valeurs sensibles aux déceptions.',
        },
        {
          heading: 'Les limites',
          body: 'Le PER se compare au sein d’un même secteur et dans le temps. Il ne dit rien de l’endettement, de la qualité des bénéfices ni de la cyclicité de l’activité.',
        },
      ],
      keyTakeaways: [
        'Le PER situe un prix par rapport aux bénéfices.',
        'Une valorisation élevée traduit une anticipation, pas une certitude.',
        'Un seul indicateur ne suffit jamais à juger une entreprise.',
      ],
      glossary: [
        { term: 'PER', definition: 'Price Earnings Ratio : cours divisé par le bénéfice par action.' },
      ],
      quiz: [
        {
          id: 'val-q1',
          question: 'Un PER élevé indique :',
          options: [
            { id: 'a', label: 'Que l’action va baisser' },
            { id: 'b', label: 'Que le marché anticipe une forte croissance des bénéfices' },
          ],
          correctOptionId: 'b',
          explanation:
            'Le PER traduit une anticipation du marché, qui peut se réaliser ou être déçue.',
        },
      ],
    },
  },
  {
    slug: 'le-risque-de-change',
    title: 'Le risque de change',
    description: 'Pourquoi un actif en dollars bouge aussi quand l’euro bouge.',
    difficulty: 'intermediate',
    estimatedMinutes: 2,
    category: 'Risque',
    themeKeys: ['currencies'],
    orderIndex: 10,
    content: {
      sections: [
        {
          heading: 'Deux effets, pas un',
          body: 'Si vous détenez une action américaine, sa valeur en euros dépend de deux choses : la performance de l’action en dollars, et l’évolution du taux de change euro-dollar. Les deux peuvent aller dans le même sens ou se compenser.',
        },
        {
          heading: 'Une exposition souvent invisible',
          body: 'Un ETF MSCI World coté en euros contient majoritairement des sociétés américaines : votre exposition au dollar est réelle même si la ligne est libellée en euros.',
        },
        {
          heading: 'Se couvrir a un coût',
          body: 'Certains fonds proposent une version « couverte » contre le risque de change. La couverture n’est pas gratuite, et supprime aussi les effets favorables.',
        },
      ],
      keyTakeaways: [
        'Un actif étranger combine performance de l’actif et variation de la devise.',
        'L’exposition au dollar est souvent plus élevée qu’elle n’en a l’air.',
        'La couverture a un coût et supprime aussi les gains de change.',
      ],
      glossary: [
        { term: 'Couverture (hedging)', definition: 'Mécanisme visant à neutraliser l’effet des variations de change.' },
      ],
      quiz: [
        {
          id: 'fx-q1',
          question: 'Un ETF World coté en euros vous expose-t-il au dollar ?',
          options: [
            { id: 'a', label: 'Non, il est coté en euros' },
            { id: 'b', label: 'Oui, via les sociétés américaines qu’il contient' },
          ],
          correctOptionId: 'b',
          explanation:
            'La devise de cotation ne change pas la devise des actifs sous-jacents.',
        },
      ],
    },
  },
];
