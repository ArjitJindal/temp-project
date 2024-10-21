import { v4 as uuid4 } from 'uuid'
import { compact } from 'lodash'
import {
  getRandomIntInclusive,
  randomFloat,
  randomInt,
  randomSubsetOfSize,
} from '../samplers/prng'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { SanctionsMedia } from '@/@types/openapi-internal/SanctionsMedia'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { SanctionsScreeningEntity } from '@/@types/openapi-internal/SanctionsScreeningEntity'
import { SanctionsMatchType } from '@/@types/openapi-internal/SanctionsMatchType'
import { SanctionsEntity } from '@/@types/openapi-internal/SanctionsEntity'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { SANCTIONS_MATCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsMatchType'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'

const COUNTRY_MAP: Record<string, string> = {
  RU: 'Russian Federation',
  TR: 'Turkey',
  PT: 'Portugal',
  US: 'United States',
  CN: 'China',
  IN: 'India',
  BR: 'Brazil',
  DE: 'Germany',
  FR: 'France',
  GB: 'United Kingdom',
  JP: 'Japan',
  CA: 'Canada',
  AU: 'Australia',
  ZA: 'South Africa',
}

const COUNTRY_CODES = Object.keys(COUNTRY_MAP)

export const sanctionsSearchHit = (
  searchId: string,
  username: string,
  userId: string,
  ruleInstanceId?: string,
  transactionId?: string,
  entity?: string
): { hit: SanctionsHit; sanctionsEntity: SanctionsEntity } => {
  const entityType =
    entity === 'USER' || entity === 'EXTERNAL_USER'
      ? 'individual'
      : 'organisation'

  const id = uuid4()
  const selectedCountryCodes = randomSubsetOfSize(
    COUNTRY_CODES,
    3
  ) as CountryCode[]
  const selectedCountries = selectedCountryCodes.map(
    (code) => COUNTRY_MAP[code]
  )

  const relevantSanctionsSources = SANCTIONS_SOURCES.filter((source) =>
    source.countryCodes?.some((code) => selectedCountryCodes.includes(code))
  )
  const relevantPepSources = PEP_SOURCES.filter((source) =>
    source.countryCodes?.some((code) => selectedCountryCodes.includes(code))
  )

  const sanctionsSources = randomSubsetOfSize(
    relevantSanctionsSources,
    Math.min(4, relevantSanctionsSources.length)
  )
  const pepSources = randomSubsetOfSize(
    relevantPepSources,
    Math.min(4, relevantPepSources.length)
  )
  const matchTypes: SanctionsMatchType[] = randomSubsetOfSize(
    SANCTIONS_MATCH_TYPES,
    getRandomIntInclusive(1, 3)
  )

  const createMediaSource = (name: string) => {
    const itemCount = randomInt(3) + 1
    const mediaItems = randomSubsetOfSize(MEDIA, itemCount)
    return {
      name,
      media: mediaItems,
    }
  }
  const name = `${username}#${randomInt(1000)}`
  const mediaSources = [
    createMediaSource('Global News Database'),
    createMediaSource('Company Adverse Media'),
  ]
  const sanctionsEntity: SanctionsEntity = {
    id: Math.random().toString(36).substring(2, 8).toUpperCase(),
    name,
    entityType,
    matchTypes,
    sanctionsSources,
    mediaSources,
    pepSources,
    countries: selectedCountries,
    countryCodes: selectedCountryCodes,
    types: compact([
      sanctionsSources.length > 0 && 'sanction',
      mediaSources.length > 0 && 'adverse-media',
      pepSources.length > 0 && 'pep',
    ]) as string[],
  }
  const hit: SanctionsHit = {
    provider: 'comply-advantage',
    searchId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sanctionsHitId: `SH-${randomInt(999999).toString().padStart(6, '0')}`,
    status: 'OPEN',
    hitContext: {
      userId,
      ruleInstanceId,
      ...(transactionId != null ? { transactionId } : {}),
      entity: entity as SanctionsScreeningEntity,
    },
    entity: {
      id: id,
      updatedAt: new Date().getTime(),
      types: [
        sanctionsSources.length > 0 && 'sanction',
        mediaSources.length > 0 && 'adverse-media',
        pepSources.length > 0 && 'pep',
      ].filter(Boolean) as string[],
      name,
      entityType,
      matchTypes,
      sanctionsSources,
      mediaSources,
      pepSources,
      countries: selectedCountries,
    },
  }
  return { hit, sanctionsEntity }
}

export const businessSanctionsSearch = (
  username: string,
  userId: string,
  ruleInstanceId?: string,
  transactionId?: string,
  entity?: string
): {
  historyItem: SanctionsSearchHistory
  hits: SanctionsHit[]
  screeningDetails: SanctionsScreeningDetails
} => {
  const searchId = uuid4()
  const screeningDetails: SanctionsScreeningDetails = {
    searchId,
    name: username,
    ruleInstanceIds: ruleInstanceId ? [ruleInstanceId] : [],
    userIds: [userId],
    transactionIds: transactionId ? [transactionId] : [],
    isOngoingScreening: false,
    isHit: true,
    entity: entity as SanctionsScreeningEntity,
    lastScreenedAt: sampleTimestamp(),
    isNew: false,
  }
  const hits: SanctionsHit[] = []
  const sanctionsEntityArray: SanctionsEntity[] = []
  const hitsCount = getRandomIntInclusive(3, 14)
  for (let i = 0; i < hitsCount; i++) {
    const { hit, sanctionsEntity } = sanctionsSearchHit(
      searchId,
      username,
      userId,
      ruleInstanceId,
      transactionId,
      entity
    )
    hits.push(hit)
    sanctionsEntityArray.push(sanctionsEntity)
  }

  const historyItem: SanctionsSearchHistory = {
    _id: searchId,
    provider: 'comply-advantage',
    request: {
      searchTerm: username,
      fuzziness: Number(randomFloat(10).toFixed(1)),
      types: randomSubsetOfSize(
        SANCTIONS_SEARCH_TYPES,
        getRandomIntInclusive(1, 3)
      ),
    },
    response: {
      hitsCount,
      data: sanctionsEntityArray,
      searchId: searchId,
      providerSearchId: `provider-${searchId}`,
      createdAt: 1683301138980,
    },
    createdAt: 1683301138980,
  }
  return { historyItem, hits, screeningDetails }
}

export const consumerSanctionsSearch = (
  username: string,
  userId: string,
  ruleInstanceId?: string,
  transactionId?: string,
  entity?: string
): {
  historyItem: SanctionsSearchHistory
  hits: SanctionsHit[]
  screeningDetails: SanctionsScreeningDetails
} => {
  const searchId = uuid4()
  const screeningDetails: SanctionsScreeningDetails = {
    searchId,
    name: username,
    ruleInstanceIds: ruleInstanceId ? [ruleInstanceId] : [],
    userIds: [userId],
    transactionIds: transactionId ? [transactionId] : [],
    entity: entity as SanctionsScreeningEntity,
    isOngoingScreening: false,
    isHit: true,
    lastScreenedAt: sampleTimestamp(),
    isNew: false,
  }

  const hits: SanctionsHit[] = []
  const sanctionsEntityArray: SanctionsEntity[] = []
  const hitsCount = getRandomIntInclusive(3, 14)
  for (let i = 0; i < hitsCount; i++) {
    const { hit, sanctionsEntity } = sanctionsSearchHit(
      searchId,
      username,
      userId,
      ruleInstanceId,
      transactionId,
      entity
    )
    hits.push(hit)
    sanctionsEntityArray.push(sanctionsEntity)
  }
  const historyItem: SanctionsSearchHistory = {
    _id: searchId,
    provider: 'comply-advantage',
    request: {
      searchTerm: username,
      fuzziness: Number(randomFloat(10).toFixed(1)),
      types: randomSubsetOfSize(
        SANCTIONS_SEARCH_TYPES,
        getRandomIntInclusive(1, 3)
      ),
    },
    response: {
      hitsCount,
      data: sanctionsEntityArray,
      searchId: searchId,
      providerSearchId: searchId,
      createdAt: 1683301138980,
    },
    createdAt: 1683301138980,
  }
  return {
    historyItem,
    hits,
    screeningDetails,
  }
}

const SANCTIONS_SOURCES: SanctionsSource[] = [
  {
    countryCodes: ['BE', 'RU'],
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    name: 'Belgium Consolidated List of the National and European Sanctions',
    fields: [
      {
        name: 'Country',
        values: ['Belgium'],
      },
      {
        name: 'Original Country Text',
        values: ['Belgium'],
      },
    ],
    url: 'https://finance.belgium.be/en/control-financial-instruments-and-institutions/compliance/financial-sanctions',
  },
  {
    countryCodes: ['AU', 'CZ'],
    name: 'company AM',
  },
  {
    countryCodes: ['AU'],
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    name: 'DFAT Australia Consolidated Sanctions List',
    fields: [
      {
        name: 'Country',
        values: ['Australia'],
      },
      {
        name: 'Original Country Text',
        values: ['Australia'],
      },
    ],
    url: 'https://www.dfat.gov.au/international-relations/security/sanctions/consolidated-list',
  },
  {
    countryCodes: ['RU'],
    name: 'Eurasian Economic Union Leadership',
    url: 'http://www.eaeunion.org/',
    fields: [
      {
        name: 'Country',
        values: ['Russia'],
      },
      {
        name: 'Original Country Text',
        values: ['Russia'],
      },
    ],
  },
  {
    countryCodes: ['RU'],
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    name: 'EU External Action Service - Consolidated list of Sanctions',
    url: 'https://webgate.ec.europa.eu/fsd/fsf#!/files',
  },
  {
    countryCodes: ['RU'],
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    name: 'United Kingdom HM Treasury Office of Financial Sanctions Implementation Consolidated List',
    fields: [
      {
        name: 'Country',
        values: ['United Kingdom'],
      },
      {
        name: 'Original Country Text',
        values: ['United Kingdom'],
      },
    ],
    url: 'https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets',
  },
  {
    countryCodes: ['RU'],
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    name: 'Liechtenstein International Sanctions',
    url: 'https://www.gesetze.li/konso/gebietssystematik?lrstart=946',
    fields: [
      {
        name: 'Country',
        values: ['Liechtenstein'],
      },
      {
        name: 'Original Country Text',
        values: ['Liechtenstein'],
      },
    ],
  },
  {
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    name: 'Ministry of Finance Japan Economic Sanctions List',
    url: 'https://www.mof.go.jp/international_policy/gaitame_kawase/gaitame/economic_sanctions/list.html',
    fields: [
      {
        name: 'Country',
        values: ['Japan'],
      },
      {
        name: 'Original Country Text',
        values: ['Japan'],
      },
    ],
  },
  {
    countryCodes: ['RU'],
    name: 'ComplyAdvantage PEP Data',
  },
]

const PEP_SOURCES: SanctionsSource[] = [
  {
    countryCodes: ['RU'],
    name: 'ComplyAdvantage PEP Data',
    fields: [
      {
        name: 'Country',
        values: ['Russia'],
      },
      {
        name: 'Original Country Text',
        values: ['Russia'],
      },
    ],
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    countryCodes: ['US', 'CA'],
    name: 'Global PEP Registry',
    fields: [
      {
        name: 'Country',
        values: ['United States', 'Canada'],
      },
      {
        name: 'Original Country Text',
        values: ['United States', 'Canada'],
      },
    ],
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
  },
  {
    countryCodes: ['BR'],
    name: 'Brazilian Government PEP Data',
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    fields: [
      {
        name: 'Country',
        values: ['Brazil'],
      },
      {
        name: 'Original Country Text',
        values: ['Brazil'],
      },
    ],
  },
  {
    countryCodes: ['DE', 'FR'],
    name: 'European PEP Records',
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    fields: [
      {
        name: 'Country',
        values: ['Germany', 'France'],
      },
      {
        name: 'Original Country Text',
        values: ['Germany', 'France'],
      },
    ],
  },
  {
    countryCodes: ['IN'],
    name: 'India PEP Watchlist',
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    fields: [
      {
        name: 'Country',
        values: ['India'],
      },
      {
        name: 'Original Country Text',
        values: ['India'],
      },
    ],
  },
  {
    countryCodes: ['CN', 'HK'],
    name: 'Asian PEP List',
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    fields: [
      {
        name: 'Country',
        values: ['China', 'Hong Kong'],
      },
      {
        name: 'Original Country Text',
        values: ['China', 'Hong Kong'],
      },
    ],
  },
  {
    countryCodes: ['ZA'],
    name: 'South African PEP Database',
    createdAt: sampleTimestamp(2 * 365 * 24 * 60 * 60 * 1000),
    fields: [
      {
        name: 'Country',
        values: ['South Africa'],
      },
      {
        name: 'Original Country Text',
        values: ['South Africa'],
      },
    ],
  },
]
const MEDIA: SanctionsMedia[] = [
  {
    date: new Date('2024-05-07T00:00:00Z').getTime(),
    snippet:
      "- Oil tycoon Mikhail Khodorkovsky, who is Russia's richest man and seen as a potential challenger to Putin, is arrested and later sentenced to 10 years in prison for tax evasion and fraud. His oil company is dismantled, most of it acquired by state oil company Rosneft.",
    title: '(no title)',
    url: 'https://halifax.citynews.ca/2024/05/07/key-events-of-vladimir-putins-24-years-in-power-in-russia/amp/',
  },
  {
    date: new Date('2024-05-20T00:00:00Z').getTime(),
    snippet:
      "The court, based in The Hague, has no police force, but those named in warrants could be arrested if they travel to one of its 124 member nations, which include most European countries. The court issued an arrest warrant for President Vladimir V. Putin of Russia in March 2023 for crimes committed during Moscow's full-scale invasion of Ukraine, including for the forcible deportation of children. A warrant was also issued for Maria Lvova-Belova, Russia's commissioner for children's rights.",
    title:
      "Biden Declares Israel's Military Operation in Gaza 'Is Not Genocide' - The New York Times",
    url: 'https://www.nytimes.com/live/2024/05/20/world/israel-gaza-war-hamas-rafah/leaders-of-past-protests-in-israel-re-emerge-as-parliament-reconvenes',
  },
  {
    date: new Date('2023-09-24T00:00:00Z').getTime(),
    snippet:
      'Por isso, em março, o Tribunal Penal Internacional (TPI) emitiu um mandado de prisão para o presidente russo, Vladimir Putin, e outra funcionária, acusando-os de raptar crianças na Ucrânia. "O Sr. Vladimir Vladimirovich Putin, nascido em 7 de outubro de 1952, Presidente da Federação Russa, é alegadamente responsável pelo crime de guerra de deportação ilegal de população (crianças) e de transferência ilegal de população (crianças) de áreas ocupadas da Ucrânia para a Federação Russa", diz o documento. A Rússia, que não reconhece o TPI, tem outra versão da história (leia mais abaixo), mas o assunto não foi abordado pelo ministro das Relações Exteriores do país, Sergey Lavrov, durante seu discurso à ONU no sábado (22).',
    title:
      'Entenda o rapto de crianças ucranianas citado por Zelensky na ONU e que embasa ordem de prisão contra Putin | Ucrânia e Rússia | G1',
    url: 'https://g1.globo.com/google/amp/mundo/ucrania-russia/noticia/2023/09/24/entenda-o-rapto-de-criancas-ucranianas-citado-por-zelensky-na-onu-e-que-embasa-ordem-de-prisao-contra-putin.ghtml',
  },
  {
    date: new Date('2023-07-21T00:00:00Z').getTime(),
    snippet:
      'Last November, he pulled out of the G20 summit in Indonesia because Western leaders had threatened to stage a walkout if he attended. Director-General in the department of international relations and cooperation Zane Dangor said on Thursday that when the ICC issued a warrant of arrest against Putin they started discussions of options of how the issue of the summit would be handled. The three options were either to move the summit away from South Africa to another BRICS country or to have a completely virtual summit or Putin following the summit in South Africa, virtually, with the rest of the BRICS leaders physically present at the summit.',
    title: 'Government and DA agree not to proceed with Putin application',
    url: 'https://www.iol.co.za/news/politics/government-and-da-agree-not-to-proceed-with-putin-application-03b73baf-1f14-4a97-af14-773a95574f75',
  },
  {
    date: new Date('2023-06-21T00:00:00Z').getTime(),
    snippet:
      'Political Views Tatarinova said that in her interactions with Zabugorsky, he did not appear to be overtly political in person, never quite showing where he stood on issues. In the same 2021 Instagram post where he mentioned a period of homelessness in the United States, he wrote that VVP -- shorthand for Vladimir Vladimirovich Putin -- "created all the conditions so that people could not receive protection in the Motherland from the service of devils," the latter a reference to corrupt Russian officials. In one video blog from October 2018, Zabugorsky criticized Russian authorities for cracking down on pro-democracy protesters in St. Peterburg, including beating women and children, and said Russians should emigrate if they so desire.',
    title:
      'He Said He Fled Russia. Then He Returned, Amid A Massive Clampdown, And Denounced America On State TV. What Happened?',
    url: 'https://www.rferl.org/amp/russia-zabugorsky-denouncing-america-clampdown/32469127.html',
  },
  {
    date: new Date('2024-05-13T00:00:00Z').getTime(),
    snippet:
      "A softly-spoken former bank clerk has stepped into the shoes of Vladimir Putin's propagandist warlord, three years after she was released from a Virginia jail for drug smuggling. Mira Terada (pictured), 36, fled back to her native Russia in 2021 after being seized on an Interpol warrant and serving 30 months on a plea bargain.",
    title:
      "How a convicted woman US felon has become Putin's new mouthpiece | Daily Mail Online",
    url: 'https://www.dailymail.co.uk/galleries/article-13411497/How-convicted-woman-felon-Putins-new-mouthpiece.html?ico=topics_pagination_desktop',
  },
  {
    date: new Date('2023-08-23T00:00:00Z').getTime(),
    snippet:
      'This year, there is an awkward situation prevailing within the group over Russian President Vladimir Putin. Putin is facing war crimes charges for allegedly deporting children from occupied areas of Ukraine. So he will participate virtually to avoid being handcuffed on arrival in Johannesburg.',
    title:
      'How cohesive are the bricks of BRICS to shake the US-led global order? | The Business Standard',
    url: 'https://www.tbsnews.net/features/panorama/how-cohesive-are-bricks-brics-shake-us-led-global-order-687022?amp',
  },
  {
    date: new Date('2024-05-21T00:00:00Z').getTime(),
    snippet:
      "Her trip had not been announced for security reasons. During a visit to one of Ukraine's largest power stations, which was destroyed by Russia last month, Baerbock accused Russian President Vladimir Putin of targeted terror against civilians. Slain Iranian Protester's Father Sentenced To 6 Years In Prison",
    title:
      "In Kyiv, Top German Diplomat Urges Allies To Protect Ukraine's Skies",
    url: 'https://www.rferl.org/a/ukraine-war-baerbock-german-kyiv-visit/32957061.html',
  },
  {
    date: new Date('2024-03-28T00:00:00Z').getTime(),
    snippet:
      ': "[I am] Kara-Murza, Vladimir Vladimirovich, date of birth September 7, 1981, convicted under criminal code articles 284.1 part one, 207.3 part two, 275. Start date of sentence, April 22 2022.',
    title:
      "Inside Putin's nightmare Arctic gulag - where prisoners are regularly stripped naked in -2C - World News - Mirror Online",
    url: 'https://www.mirror.co.uk/news/world-news/inside-putins-nightmare-arctic-gulag-32458490?int_campaign=continue_reading_button&int_medium=amp&int_source=amp_continue_reading',
  },
  {
    date: new Date('2023-04-18T00:00:00Z').getTime(),
    snippet:
      ': ICC judges issue arrest warrants against Vladimir Vladimirovich Putin and Maria Alekseyevna Lvova-Belova (March 17, 2023), https :',
    title: 'Intl Court Ruling on Iranian Assets Affects Arbitration Award Enf',
    url: 'https://natlawreview.com/article/decision-international-court-justice-certain-iranian-assets?amp',
  },
]
