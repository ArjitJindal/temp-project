import { v4 as uuid4 } from 'uuid'
import { randomSubsetOfSize } from '../samplers/prng'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { SanctionsSource } from '@/@types/openapi-internal/SanctionsSource'
import { SanctionsMedia } from '@/@types/openapi-internal/SanctionsMedia'

export const sanctionsSearchHit = (
  searchId: string,
  username: string,
  userId: string
): SanctionsHit => {
  const id = uuid4()
  const sanctionsSources = randomSubsetOfSize(SANCTIONS_SOURCES, 4)
  const mediaSources = randomSubsetOfSize(MEDIA, 4)
  const pepSources = randomSubsetOfSize(PEP_SOURCES, 4)
  return {
    searchId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sanctionsHitId: `SH-${Math.round(999999 * Math.random())
      .toString()
      .padStart(6, '0')}`,
    status: 'OPEN',
    hitContext: {
      userId,
    },
    entity: {
      id: id,
      updatedAt: new Date().getTime(),
      types: [
        sanctionsSources.length > 0 && 'sanction',
        mediaSources.length > 0 && 'adverse-media',
        pepSources.length > 0 && 'pep',
      ].filter(Boolean) as string[],
      name: `${username}#${Math.round(1000 * Math.random())}`,
      entityType: 'organisation',
      sanctionsSources,
      mediaSources,
      pepSources,
      countries: ['Russian Federation', 'Turkey', 'Portugal'],
    },
  }
}

export const businessSanctionsSearch = (
  username: string,
  userId: string
): {
  historyItem: SanctionsSearchHistory
  hits: SanctionsHit[]
} => {
  const searchId = uuid4()
  const hits = [
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
  ]
  const historyItem = {
    _id: searchId,
    request: {
      searchTerm: username,
    },
    response: {
      hitsCount: hits.length,
      searchId: '229b87fa-05ab-4b1d-82f8-b2df32fdcab7',
      providerSearchId: 'provider-229b87fa-05ab-4b1d-82f8-b2df32fdcab7',
      createdAt: 1683301138980,
    },
    createdAt: 1683301138980,
  }
  return { historyItem, hits }
}

export const consumerSanctionsSearch = (
  username: string,
  userId: string
): {
  historyItem: SanctionsSearchHistory
  hits: SanctionsHit[]
} => {
  const searchId = uuid4()
  const hits = [
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
    sanctionsSearchHit(searchId, username, userId),
  ]
  const historyItem = {
    _id: searchId,
    request: {
      searchTerm: username,
    },
    response: {
      hitsCount: hits.length,
      searchId: searchId,
      providerSearchId: searchId,
      createdAt: 1683301138980,
    },
    createdAt: 1683301138980,
  }
  return {
    historyItem,
    hits,
  }
}

const SANCTIONS_SOURCES: SanctionsSource[] = [
  {
    countryCodes: ['RU'],
    createdAt: new Date('2022-02-25T00:00:00Z').getTime(),
    name: 'Belgium Consolidated List of the National and European Sanctions',
    url: 'https://finance.belgium.be/en/control-financial-instruments-and-institutions/compliance/financial-sanctions',
  },
  {
    countryCodes: ['AU', 'CZ'],
    name: 'company AM',
  },
  {
    countryCodes: [
      'BE',
      'BR',
      'CA',
      'CF',
      'ES',
      'FR',
      'GB',
      'IR',
      'JP',
      'KN',
      'LB',
      'MD',
      'MX',
      'MY',
      'NG',
      'NL',
      'PL',
      'QA',
      'RU',
      'SG',
      'UA',
      'US',
      'ZA',
    ],
    name: 'ComplyAdvantage Adverse Media',
  },
  {
    countryCodes: ['RU'],
    createdAt: new Date('2022-03-01T00:00:00Z').getTime(),
    name: 'DFAT Australia Consolidated Sanctions List',
    url: 'https://www.dfat.gov.au/international-relations/security/sanctions/consolidated-list',
  },
  {
    countryCodes: ['RU'],
    name: 'Eurasian Economic Union Leadership',
    url: 'http://www.eaeunion.org/',
  },
  {
    countryCodes: ['RU'],
    createdAt: new Date('2022-02-25T00:00:00Z').getTime(),
    name: 'EU External Action Service - Consolidated list of Sanctions',
    url: 'https://webgate.ec.europa.eu/fsd/fsf#!/files',
  },
  {
    countryCodes: ['RU'],
    createdAt: new Date('2022-02-25T00:00:00Z').getTime(),
    name: 'United Kingdom HM Treasury Office of Financial Sanctions Implementation Consolidated List',
    url: 'https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets',
  },
  {
    countryCodes: ['RU'],
    createdAt: new Date('2022-03-10T00:00:00Z').getTime(),
    name: 'Liechtenstein International Sanctions',
    url: 'https://www.gesetze.li/konso/gebietssystematik?lrstart=946',
  },
  {
    createdAt: new Date('2022-03-01T00:00:00Z').getTime(),
    name: 'Ministry of Finance Japan Economic Sanctions List',
    url: 'https://www.mof.go.jp/international_policy/gaitame_kawase/gaitame/economic_sanctions/list.html',
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
    createdAt: new Date('2022-03-10T00:00:00Z').getTime(),
  },
  {
    countryCodes: ['US', 'CA'],
    name: 'Global PEP Registry',
    createdAt: new Date('2021-11-15T12:00:00Z').getTime(),
  },
  {
    countryCodes: ['BR'],
    name: 'Brazilian Government PEP Data',
    createdAt: new Date('2020-06-22T08:30:00Z').getTime(),
  },
  {
    countryCodes: ['DE', 'FR'],
    name: 'European PEP Records',
    createdAt: new Date('2022-01-05T14:45:00Z').getTime(),
  },
  {
    countryCodes: ['IN'],
    name: 'India PEP Watchlist',
    createdAt: new Date('2023-02-01T09:15:00Z').getTime(),
  },
  {
    countryCodes: ['CN', 'HK'],
    name: 'Asian PEP List',
    createdAt: new Date('2021-09-10T10:00:00Z').getTime(),
  },
  {
    countryCodes: ['ZA'],
    name: 'South African PEP Database',
    createdAt: new Date('2020-12-05T17:20:00Z').getTime(),
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
