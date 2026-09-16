import type { NewsCategory } from '@nova/types';

/**
 * Demonstration news corpus.
 *
 * Fictional but realistic financial events used to exercise the whole pipeline
 * (classification → entity mapping → scoring → personalisation → explanation) without
 * depending on a licensed news feed. Every item surfaces in the app with a DEMO DATA badge,
 * and the "source" values are deliberately generic so no real outlet is impersonated.
 */
export interface DemoNewsItem {
  title: string;
  summary: string;
  body: string;
  source: string;
  sourceUrl: string | null;
  hoursAgo: number;
  category: NewsCategory;
  symbols: string[];
}

export const DEMO_NEWS: DemoNewsItem[] = [
  {
    title: 'La BCE maintient ses taux directeurs et évoque une baisse progressive',
    summary:
      'La Banque centrale européenne a laissé ses taux inchangés. Sa présidente indique que les prochaines décisions dépendront des données d’inflation des prochains mois.',
    body: 'Le conseil des gouverneurs a décidé de maintenir le taux de dépôt à son niveau actuel. Le communiqué insiste sur une approche « réunion par réunion » et sur la dépendance aux données. Les marchés obligataires européens ont réagi modérément. La trajectoire exacte des prochaines décisions reste incertaine.',
    source: 'Communiqué de démonstration — banque centrale',
    sourceUrl: null,
    hoursAgo: 3,
    category: 'central_banks',
    symbols: ['BNP.PA', 'OBLI.PA'],
  },
  {
    title: 'L’inflation en zone euro ralentit à 2,2 % sur un an',
    summary:
      'L’indice des prix à la consommation progresse moins vite que le mois précédent, porté par le recul des prix de l’énergie.',
    body: 'La désinflation se poursuit, principalement sous l’effet de la composante énergie. L’inflation sous-jacente, qui exclut l’énergie et l’alimentation, recule plus lentement. Les économistes divergent sur la persistance de cette tendance.',
    source: 'Publication statistique de démonstration',
    sourceUrl: null,
    hoursAgo: 6,
    category: 'macro',
    symbols: [],
  },
  {
    title: 'Le pétrole Brent progresse de 3 % après une réduction de production',
    summary:
      'Les prix du baril montent après l’annonce d’une réduction de l’offre par plusieurs pays producteurs.',
    body: 'Le Brent gagne environ 3 % sur la séance. Les entreprises fortement consommatrices d’énergie et les compagnies de transport sont traditionnellement sensibles à ce type de mouvement, à la hausse comme à la baisse. L’ampleur et la durée de cette évolution ne sont pas connues.',
    source: 'Dépêche matières premières de démonstration',
    sourceUrl: null,
    hoursAgo: 5,
    category: 'commodities',
    symbols: ['TTE.PA', 'AIR.PA'],
  },
  {
    title:
      'Les valeurs technologiques reculent après des résultats mitigés dans les semi-conducteurs',
    summary:
      'Un acteur majeur des équipements pour semi-conducteurs publie des commandes inférieures aux attentes du consensus.',
    body: 'Le titre recule en séance, entraînant plusieurs valeurs du secteur. La direction évoque un décalage de commandes plutôt qu’une baisse de la demande finale, une interprétation que tous les analystes ne partagent pas.',
    source: 'Note sectorielle de démonstration',
    sourceUrl: null,
    hoursAgo: 8,
    category: 'sector',
    symbols: ['ASML.AS', 'NVDA'],
  },
  {
    title: 'Le dollar se renforce face à l’euro après des chiffres d’emploi américains solides',
    summary:
      'La parité euro-dollar recule à la suite de statistiques d’emploi supérieures aux attentes aux États-Unis.',
    body: 'Un dollar plus fort mécaniquement augmente la valeur en euros des actifs libellés en dollars pour un investisseur de la zone euro, et inversement. Cet effet de change est distinct de la performance propre des actifs concernés.',
    source: 'Dépêche devises de démonstration',
    sourceUrl: null,
    hoursAgo: 10,
    category: 'currencies',
    symbols: ['AAPL', 'MSFT'],
  },
  {
    title:
      'Un projet de réglementation européenne encadre davantage les frais des fonds distribués aux particuliers',
    summary:
      'Un texte en discussion prévoit des obligations de transparence renforcées sur les frais supportés par les investisseurs particuliers.',
    body: 'Le calendrier d’adoption et le contenu final du texte ne sont pas arrêtés. Les sociétés de gestion et les distributeurs seraient les premiers concernés. Les conséquences pour les investisseurs particuliers dépendront de la version définitive.',
    source: 'Veille réglementaire de démonstration',
    sourceUrl: null,
    hoursAgo: 14,
    category: 'regulation',
    symbols: [],
  },
  {
    title:
      'Tensions commerciales : de nouveaux droits de douane envisagés sur certains composants électroniques',
    summary:
      'Des discussions portent sur l’instauration de droits de douane visant une catégorie de composants importés.',
    body: 'Les chaînes d’approvisionnement de l’électronique grand public et de l’industrie pourraient être concernées. À ce stade, il s’agit d’un projet : ni le périmètre ni le calendrier ne sont confirmés.',
    source: 'Dépêche géopolitique de démonstration',
    sourceUrl: null,
    hoursAgo: 20,
    category: 'geopolitics',
    symbols: ['AAPL', 'ASML.AS'],
  },
  {
    title: 'Le secteur bancaire européen publie des résultats trimestriels en hausse',
    summary:
      'Plusieurs grandes banques européennes affichent une progression de leur produit net bancaire sur le trimestre.',
    body: 'La hausse s’explique en partie par les marges d’intérêt. Les banques rappellent que cet effet dépend du niveau des taux, qui peut évoluer. Le coût du risque reste un point de vigilance mentionné par les directions.',
    source: 'Synthèse résultats de démonstration',
    sourceUrl: null,
    hoursAgo: 26,
    category: 'company',
    symbols: ['BNP.PA'],
  },
  {
    title: 'Les rendements obligataires souverains européens se détendent légèrement',
    summary:
      'Le rendement des emprunts d’État à 10 ans recule de quelques points de base sur la séance.',
    body: 'Un recul des rendements correspond mécaniquement à une hausse du prix des obligations déjà émises. L’effet sur un portefeuille dépend de la duration des obligations détenues, directement ou via un fonds.',
    source: 'Dépêche obligataire de démonstration',
    sourceUrl: null,
    hoursAgo: 30,
    category: 'markets',
    symbols: ['OBLI.PA'],
  },
  {
    title: 'L’or atteint un plus haut de plusieurs mois dans un contexte d’incertitude',
    summary: 'Le métal précieux progresse, soutenu par une demande de valeurs refuges.',
    body: 'Les mouvements de l’or sont souvent commentés comme un indicateur d’aversion au risque. Cette lecture est une interprétation courante, pas une règle vérifiée à chaque épisode de marché.',
    source: 'Dépêche matières premières de démonstration',
    sourceUrl: null,
    hoursAgo: 34,
    category: 'commodities',
    symbols: ['GOLD.PA'],
  },
  {
    title: 'Un grand groupe du luxe annonce un ralentissement de ses ventes en Asie',
    summary:
      'Le groupe fait état d’une croissance plus faible qu’attendu sur sa zone Asie hors Japon.',
    body: 'La direction évoque un effet de comparaison avec un trimestre précédent exceptionnel. Les analystes restent partagés sur la durée de ce ralentissement.',
    source: 'Communiqué de démonstration — société cotée',
    sourceUrl: null,
    hoursAgo: 40,
    category: 'company',
    symbols: ['MC.PA'],
  },
  {
    title: 'Le bitcoin recule après plusieurs séances de hausse',
    summary: 'La principale cryptomonnaie perd du terrain après une série de séances positives.',
    body: 'Les variations des cryptoactifs sont généralement plus amples que celles des actions. Une position, même modeste, peut donc peser sur la variation quotidienne d’un portefeuille.',
    source: 'Dépêche cryptoactifs de démonstration',
    sourceUrl: null,
    hoursAgo: 12,
    category: 'markets',
    symbols: ['BTC-EUR', 'ETH-EUR'],
  },
];
