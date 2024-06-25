export const MOCK_CA_SEARCH_RESPONSE = {
  status: 'success',
  code: 200,
  content: {
    data: {
      id: 1051192082,
      ref: '1665008971-sY_uzk_L',
      searcher_id: 21260,
      assignee_id: 21260,
      filters: {
        country_codes: [],
        exact_match: false,
        fuzziness: 0.5,
        remove_deceased: 0,
        types: [
          'pep',
          'sanction',
          'warning',
          'fitness-probity',
          'pep-class-4',
          'pep-class-2',
          'pep-class-3',
          'pep-class-1',
        ],
      },
      match_status: 'potential_match',
      risk_level: 'unknown',
      search_term: 'Huawei',
      submitted_term: 'Huawei',
      client_ref: null,
      total_hits: 266,
      total_matches: 266,
      total_blacklist_hits: 0,
      created_at: '2022-10-05 22:29:31',
      updated_at: '2022-10-05 22:29:31',
      tags: [],
      labels: [],
      limit: 500,
      offset: 0,
      searcher: {
        id: 21260,
        email: 'chia@flagright.com',
        name: 'Chia-Lun Wu',
        phone: null,
        created_at: '2022-05-17 07:48:50',
        user_is_active: true,
      },
      assignee: {
        id: 21260,
        email: 'chia@flagright.com',
        name: 'Chia-Lun Wu',
        phone: null,
        created_at: '2022-05-17 07:48:50',
        user_is_active: true,
      },
      hits: [
        {
          doc: {
            id: 'XJB0OYBBO69VPWU',
            last_updated_utc: '2022-09-15T13:29:54Z',
            created_utc: '2016-07-31T08:37:32Z',
            fields: [
              {
                name: 'Country',
                source: 'entity-list-us-bureau-of-industry-and-security',
                value: 'China',
              },
              {
                name: 'Original Country Text',
                source: 'entity-list-us-bureau-of-industry-and-security',
                value: "CHINA, PEOPLE'S REPUBLIC OF",
              },
              {
                name: 'Address',
                source: 'entity-list-us-bureau-of-industry-and-security',
                value:
                  'Guangdong, China and No. 2 Xincheng Avenue, Songshan Lake Road, Dongguan City, Guangdong, China; and Songshan Lake Base, Guangdong, China',
              },
              {
                name: 'Designation Act',
                source: 'entity-list-us-bureau-of-industry-and-security',
                value:
                  '84 FR 22963, 5/21/19. 85 FR 29853, 5/19/20. 85 FR 36720, 6/18/20. 85 FR 51603, 8/20/20. 87 FR 6026, 2/3/22. 87 FR 55250, 9/9/22.',
              },
              {
                name: 'Issuing Authority',
                source: 'entity-list-us-bureau-of-industry-and-security',
                value: 'Bureau of Industry and Security',
              },
              {
                name: 'Other Info',
                source: 'entity-list-us-bureau-of-industry-and-security',
                value: 'Presumption of denial',
              },
              {
                name: 'Sanction Type',
                source: 'entity-list-us-bureau-of-industry-and-security',
                value:
                  'LICENSE REQUIREMENT: For all items subject to the EAR, see §§ 734.9(e),1 and 744.11 of the EAR, EXCEPT2 for technology subject to the EAR that is designated as EAR99, or controlled on the Commerce Control List for anti-terrorism reasons only, when released to members of a "standards organization" (see § 772.1) for the purpose of contributing to the revision or development of a "standard" (see § 772.1)',
              },
              {
                name: 'Countries',
                tag: 'country_names',
                value: 'China',
              },
            ],
            types: ['sanction'],
            name: 'Huawei Device',
            entity_type: 'organisation',
            aka: [
              {
                name: 'Huawei Device Co., Ltd.',
              },
              {
                name: 'Huawei Device',
              },
              {
                name: 'Songshan Lake Southern Factory Dongguan',
              },
            ],
            sources: ['entity-list-us-bureau-of-industry-and-security'],
            keywords: [],
            source_notes: {
              'entity-list-us-bureau-of-industry-and-security': {
                aml_types: ['sanction'],
                country_codes: ['CN'],
                listing_started_utc: '2020-08-22T00:00:00Z',
                name: 'United States Bureau of Industry and Security Entity List',
                url: 'https://www.ecfr.gov/current/title-15/part-744',
              },
            },
          },
          match_types: ['name_exact'],
          match_types_details: [
            {
              aml_types: ['sanction'],
              matching_name: 'Huawei Device Co Ltd',
              name_matches: [
                {
                  match_types: ['exact_match'],
                  query_term: 'huawei',
                },
              ],
              secondary_matches: [],
              sources: [
                'United States Bureau of Industry and Security Entity List',
              ],
            },
            {
              aml_types: ['sanction'],
              matching_name: 'Huawei Device',
              name_matches: [
                {
                  match_types: ['exact_match'],
                  query_term: 'huawei',
                },
              ],
              secondary_matches: [],
              sources: [
                'United States Bureau of Industry and Security Entity List',
              ],
            },
          ],
          score: 1.7,
        },
      ],
      blacklist_hits: [],
    },
  },
}

export const MOCK_CA_SEARCH_RESPONSE_2 = {
  status: 'success',
  code: 200,
  content: {
    data: {
      client_ref: null,
      id: 1761294325,
      ref: '1716904888-3WEGJaZd',
      searcher_id: 27459,
      assignee_id: 27459,
      filters: {
        country_codes: [],
        exact_match: false,
        fuzziness: 0.5,
        remove_deceased: 0,
        types: [
          'pep-class-1',
          'pep-class-2',
          'pep-class-3',
          'pep-class-4',
          'adverse-media-v2-property',
          'adverse-media-v2-financial-aml-cft',
          'adverse-media-v2-fraud-linked',
          'adverse-media-v2-narcotics-aml-cft',
          'adverse-media-v2-violence-aml-cft',
          'adverse-media-v2-terrorism',
          'adverse-media-v2-cybercrime',
          'adverse-media-v2-general-aml-cft',
          'adverse-media-v2-regulatory',
          'adverse-media-v2-financial-difficulty',
          'adverse-media-v2-violence-non-aml-cft',
          'adverse-media-v2-other-financial',
          'adverse-media-v2-other-serious',
          'adverse-media-v2-other-minor',
        ],
      },
      match_status: 'potential_match',
      risk_level: 'unknown',
      search_term: 'Putin',
      submitted_term: 'Putin',
      total_hits: 500,
      total_matches: 927,
      total_blacklist_hits: 0,
      created_at: '2024-05-28 14:01:28',
      updated_at: '2024-05-28 14:01:28',
      blacklist_filters: {
        blacklist_ids: [],
      },
      tags: [],
      labels: [],
      search_profile: {
        name: 'All',
        slug: 'd563b827-7baa-4a0c-a2ae-7e38e5051cf2',
      },
      limit: 500,
      offset: 0,
      searcher: {
        id: 27459,
        email: 'chia+sandbox@flagright.com',
        name: 'Chia Lun Wu',
        phone: null,
        created_at: '2023-04-03 12:46:37',
        user_is_active: true,
      },
      assignee: {
        id: 27459,
        email: 'chia+sandbox@flagright.com',
        name: 'Chia Lun Wu',
        phone: null,
        created_at: '2023-04-03 12:46:37',
        user_is_active: true,
      },
      hits: [
        {
          doc: {
            id: 'LIZCQ58HX6MYKMO',
            last_updated_utc: '2024-05-28T04:20:21Z',
            created_utc: '2017-11-03T00:38:00Z',
            fields: [
              {
                name: 'Nationality',
                source: 'hm-treasury-list',
                value: 'Russian Federation',
              },
              {
                name: 'Nationality',
                source: 'ofac-sdn-list',
                value: 'Russian Federation',
              },
            ],
            types: [
              'adverse-media',
              'pep',
              'pep-class-1',
              'pep-class-2',
              'sanction',
            ],
            name: 'Vladimir Putiin',
            entity_type: 'person',
            aka: [
              {
                name: 'Путин Владимир',
              },
              {
                name: 'Putin Vladimir Vladimirovitj',
              },
              {
                name: 'Valadimir Putin',
              },
              {
                name: 'Путин Владимир Путин',
              },
            ],
            associates: [
              {
                association: 'підлеглий',
                name: 'ABRAMCHENKO Victoria Valerievna',
              },
              {
                association: 'partner',
                name: 'ABRAMOVICH Roman Arkadyevich',
              },
              {
                association: 'соратник',
                name: 'AMELCHENKOVA / ZANKO Olga Nikolaevna',
              },
              {
                association: 'partner',
                name: 'ANISIMOV Vasily Vasilievich',
              },
              {
                association: 'підлеглий',
                name: 'AVDEEV Alexey Yurevich',
              },
              {
                association: 'partner',
                name: 'AVEN Petr Olegovich',
              },
              {
                association: 'соратник',
                name: 'AZIMOV Rakhim Azizboevich',
              },
            ],
            sources: [
              'belgium-consolidated-list-of-the-national-and-european-sanctions',
              'company-am',
              'complyadvantage',
              'complyadvantage-adverse-media',
              'dfat-australia-list',
              'eurasian-economic-union-leadership',
              'europe-sanctions-list',
              'hm-treasury-list',
              'liechtenstein-international-sanctions',
              'ministry-of-finance-japan-economic-sanctions-list',
              'monaco-economic-sanctions',
              'new-zealand-ministry-of-foreign-affairs-and-trade-russia-sanctions-act',
              'ofac-sdn-list',
              'russia-president',
              'russia-security-council-leadership',
              'russia-state-council-leadership',
              'sanction-related-entities',
              'special-economic-measures-act',
              'swiss-seco-list',
              'tresor-direction-generale',
              'ukraine-national-agency-on-corruption-prevention-sanctions',
              'ukraine-sanctions-national-security-and-defense-council-nsdc-special-economic-and-other-restrictive-measures-persons',
              'us-cia-world-leaders',
            ],
            keywords: [],
            media: [
              {
                date: '2024-05-07T00:00:00Z',
                snippet:
                  "- Oil tycoon Mikhail Khodorkovsky, who is Russia's richest man and seen as a potential challenger to Putin, is arrested and later sentenced to 10 years in prison for tax evasion and fraud. His oil company is dismantled, most of it acquired by state oil company Rosneft.",
                title: '(no title)',
                url: 'https://halifax.citynews.ca/2024/05/07/key-events-of-vladimir-putins-24-years-in-power-in-russia/amp/',
              },
              {
                date: '2024-05-20T00:00:00Z',
                snippet:
                  "The court, based in The Hague, has no police force, but those named in warrants could be arrested if they travel to one of its 124 member nations, which include most European countries. The court issued an arrest warrant for President Vladimir V. Putin of Russia in March 2023 for crimes committed during Moscow's full-scale invasion of Ukraine, including for the forcible deportation of children. A warrant was also issued for Maria Lvova-Belova, Russia's commissioner for children's rights.",
                title:
                  "Biden Declares Israel's Military Operation in Gaza 'Is Not Genocide' - The New York Times",
                url: 'https://www.nytimes.com/live/2024/05/20/world/israel-gaza-war-hamas-rafah/leaders-of-past-protests-in-israel-re-emerge-as-parliament-reconvenes',
              },
              {
                date: '2023-09-24T00:00:00Z',
                snippet:
                  'Por isso, em março, o Tribunal Penal Internacional (TPI) emitiu um mandado de prisão para o presidente russo, Vladimir Putin, e outra funcionária, acusando-os de raptar crianças na Ucrânia. "O Sr. Vladimir Vladimirovich Putin, nascido em 7 de outubro de 1952, Presidente da Federação Russa, é alegadamente responsável pelo crime de guerra de deportação ilegal de população (crianças) e de transferência ilegal de população (crianças) de áreas ocupadas da Ucrânia para a Federação Russa", diz o documento. A Rússia, que não reconhece o TPI, tem outra versão da história (leia mais abaixo), mas o assunto não foi abordado pelo ministro das Relações Exteriores do país, Sergey Lavrov, durante seu discurso à ONU no sábado (22).',
                title:
                  'Entenda o rapto de crianças ucranianas citado por Zelensky na ONU e que embasa ordem de prisão contra Putin | Ucrânia e Rússia | G1',
                url: 'https://g1.globo.com/google/amp/mundo/ucrania-russia/noticia/2023/09/24/entenda-o-rapto-de-criancas-ucranianas-citado-por-zelensky-na-onu-e-que-embasa-ordem-de-prisao-contra-putin.ghtml',
              },
              {
                date: '2023-07-21T00:00:00Z',
                snippet:
                  'Last November, he pulled out of the G20 summit in Indonesia because Western leaders had threatened to stage a walkout if he attended. Director-General in the department of international relations and cooperation Zane Dangor said on Thursday that when the ICC issued a warrant of arrest against Putin they started discussions of options of how the issue of the summit would be handled. The three options were either to move the summit away from South Africa to another BRICS country or to have a completely virtual summit or Putin following the summit in South Africa, virtually, with the rest of the BRICS leaders physically present at the summit.',
                title:
                  'Government and DA agree not to proceed with Putin application',
                url: 'https://www.iol.co.za/news/politics/government-and-da-agree-not-to-proceed-with-putin-application-03b73baf-1f14-4a97-af14-773a95574f75',
              },
              {
                date: '2023-06-21T00:00:00Z',
                snippet:
                  'Political Views Tatarinova said that in her interactions with Zabugorsky, he did not appear to be overtly political in person, never quite showing where he stood on issues. In the same 2021 Instagram post where he mentioned a period of homelessness in the United States, he wrote that VVP -- shorthand for Vladimir Vladimirovich Putin -- "created all the conditions so that people could not receive protection in the Motherland from the service of devils," the latter a reference to corrupt Russian officials. In one video blog from October 2018, Zabugorsky criticized Russian authorities for cracking down on pro-democracy protesters in St. Peterburg, including beating women and children, and said Russians should emigrate if they so desire.',
                title:
                  'He Said He Fled Russia. Then He Returned, Amid A Massive Clampdown, And Denounced America On State TV. What Happened?',
                url: 'https://www.rferl.org/amp/russia-zabugorsky-denouncing-america-clampdown/32469127.html',
              },
              {
                date: '2024-05-13T00:00:00Z',
                snippet:
                  "A softly-spoken former bank clerk has stepped into the shoes of Vladimir Putin's propagandist warlord, three years after she was released from a Virginia jail for drug smuggling. Mira Terada (pictured), 36, fled back to her native Russia in 2021 after being seized on an Interpol warrant and serving 30 months on a plea bargain.",
                title:
                  "How a convicted woman US felon has become Putin's new mouthpiece | Daily Mail Online",
                url: 'https://www.dailymail.co.uk/galleries/article-13411497/How-convicted-woman-felon-Putins-new-mouthpiece.html?ico=topics_pagination_desktop',
              },
              {
                date: '2023-08-23T00:00:00Z',
                snippet:
                  'This year, there is an awkward situation prevailing within the group over Russian President Vladimir Putin. Putin is facing war crimes charges for allegedly deporting children from occupied areas of Ukraine. So he will participate virtually to avoid being handcuffed on arrival in Johannesburg.',
                title:
                  'How cohesive are the bricks of BRICS to shake the US-led global order? | The Business Standard',
                url: 'https://www.tbsnews.net/features/panorama/how-cohesive-are-bricks-brics-shake-us-led-global-order-687022?amp',
              },
              {
                date: '2024-05-21T00:00:00Z',
                snippet:
                  "Her trip had not been announced for security reasons. During a visit to one of Ukraine's largest power stations, which was destroyed by Russia last month, Baerbock accused Russian President Vladimir Putin of targeted terror against civilians. Slain Iranian Protester's Father Sentenced To 6 Years In Prison",
                title:
                  "In Kyiv, Top German Diplomat Urges Allies To Protect Ukraine's Skies",
                url: 'https://www.rferl.org/a/ukraine-war-baerbock-german-kyiv-visit/32957061.html',
              },
              {
                date: '2024-03-28T00:00:00Z',
                snippet:
                  ': "[I am] Kara-Murza, Vladimir Vladimirovich, date of birth September 7, 1981, convicted under criminal code articles 284.1 part one, 207.3 part two, 275. Start date of sentence, April 22 2022.',
                title:
                  "Inside Putin's nightmare Arctic gulag - where prisoners are regularly stripped naked in -2C - World News - Mirror Online",
                url: 'https://www.mirror.co.uk/news/world-news/inside-putins-nightmare-arctic-gulag-32458490?int_campaign=continue_reading_button&int_medium=amp&int_source=amp_continue_reading',
              },
              {
                date: '2023-04-18T00:00:00Z',
                snippet:
                  ': ICC judges issue arrest warrants against Vladimir Vladimirovich Putin and Maria Alekseyevna Lvova-Belova (March 17, 2023), https :',
                title:
                  'Intl Court Ruling on Iranian Assets Affects Arbitration Award Enf',
                url: 'https://natlawreview.com/article/decision-international-court-justice-certain-iranian-assets?amp',
              },
              {
                date: '2024-05-26T00:00:00Z',
                snippet:
                  'Why pro-Hamas sympathies when Hamas actually is genocidal? Granted there is plenty of blame to go around but where is the consciousness, much less outrage, toward the army in Myanmar waging war on their own minorities and civilians, the Chinese government imprisoning over a million Uyghurs in a cultural genocide and threatening to invade a democracy in Taiwan, Kim Jong Un running a gulag and starving his people, Vladimir Putin slaughtering hundreds of thousands of Ukrainians and Russians, or the Iranian Mullahs killing young women who refuse to wear a hijab? - Clifford Bixler, Bonny Doon',
                title:
                  'Letter | Where is the outrage over the many other atrocities? – Santa Cruz Sentinel',
                url: 'https://www.santacruzsentinel.com/2024/05/26/letter-where-is-the-outrage-over-the-many-other-atrocities/amp/',
              },
              {
                date: '2023-12-04T00:00:00Z',
                snippet:
                  'A Câmara de Pré-Julgamento II do TPI considerou que os dois acusados são responsáveis pelo crime de guerra de deportação ilegal de crianças de áreas ocupadas da Ucrânia para a Rússia, segundo comunicado do TPI. "O Sr. Vladimir Vladimirovich Putin, nascido em 7 de outubro de 1952, Presidente da Federação Russa, é alegadamente responsável pelo crime de guerra de deportação ilegal de população (crianças) e de transferência ilegal de população (crianças) de áreas ocupadas da Ucrânia para a Federação Russa", diz a nota.',
                title:
                  "Lula diz que Brasil convidará Putin para reunião do G20 no Rio, em 2024: 'Se ele comparecer, sabe o que pode acontecer' | Política | G1",
                url: 'https://g1.globo.com/google/amp/politica/noticia/2023/12/04/lula-diz-que-brasil-convidara-putin-para-reunioes-do-brics-e-do-g20-se-ele-comparecer-sabe-o-que-pode-acontecer.ghtml',
              },
              {
                date: '2023-12-04T00:00:00Z',
                snippet:
                  'O presidente russo foi acusado de ser o responsável por deportação ilegal de crianças em áreas ocupadas da Ucrânia para a Rússia. "O Sr. Vladimir Vladimirovich Putin, nascido em 7 de outubro de 1952, Presidente da Federação Russa, é alegadamente responsável pelo crime de guerra de deportação ilegal de população (crianças) e de transferência ilegal de população (crianças) de áreas ocupadas da Ucrânia para a Federação Russa", declarou o tribunal. O presidente russo não concordou com a decisão, mas tem participado de eventos internacionais por videoconferências.',
                title:
                  'Lula diz que Putin será chamado pelo Brasil para reunião do G20 no Rio',
                url: 'https://fanoticias.com.br/lula-diz-que-putin-sera-chamado-pelo-brasil-para-reuniao-do-g20-no-rio/',
              },
              {
                date: '2024-05-21T00:00:00Z',
                snippet:
                  'One of his first acts as prosecutor, which took many by surprise, was to "deprioritize" an investigation into abuse of prisoners by American forces in Afghanistan, instead focusing on the larger-scale alleged crimes by the Taliban and Islamic State. He began an investigation into Russia\'s invasion of Ukraine soon after it began in 2022, and obtained an arrest warrant for President Vladimir V. Putin of Russia and another Russian official in March 2023. He had shown little progress in an investigation, opened in 2021, of alleged crimes by Israel against Palestinians, nor of crimes by Hamas.',
                title:
                  'More Than 800,000 Have Fled Rafah, UN Official Says: Israel-Hamas War Latest Updates - The New York Times',
                url: 'https://www.nytimes.com/live/2024/05/21/world/israel-gaza-war-hamas-rafah',
              },
              {
                date: '2023-04-22T00:00:00Z',
                snippet:
                  'Alexie needed treatment from doctors in Germany to recover. And when he returned to Russia, President Putin had him imprisoned for violating probation (on an earlier trumped-up charge) for having left Russia to seek proper medical attention. "PUTIN CRITIC JAILED IN TREASON CASE FOR 25 YEARS"',
                title:
                  'More reports about Mad Vlad Putin - Santa Barbara News-Press',
                url: 'https://newspress.com/more-reports-about-mad-vlad-putin/',
              },
              {
                date: '2024-03-13T00:00:00Z',
                snippet:
                  'We\'re ready," Mr. Putin said. In the interview, Mr. Putin also denied having considered using weapons of mass destruction in Ukraine in the fall of 2022, as American intelligence officials have asserted. The comments appeared aimed in large part at the Russian electorate, coming two days before polls open in the presidential election, which runs from Friday to Sunday.',
                title:
                  'Putin Plays Down Threat of Nuclear War in Pre-Election State TV Interview - The New York Times',
                url: 'https://www.nytimes.com/2024/03/13/world/europe/russia-putin-nuclear-war-ukraine.html',
              },
              {
                date: '2024-03-22T00:00:00Z',
                snippet:
                  'which is four times bigger than Chernobyl. Putin, 71, unleashed hell on civilians using a deadly arsenal of 88 missiles and 66 drones -',
                title:
                  "Putin made chilling NUCLEAR threat when he emptied arsenal for biggest ever blitz...he can 'smell weakness', experts warn",
                url: 'https://www.thesun.co.uk/news/26860486/putin-nuclear-threat-emptied-arsenal-ukraine/amp/',
              },
              {
                date: '2024-03-22T00:00:00Z',
                snippet:
                  'which is four times bigger than Chernobyl. Putin, 71, unleashed hell on civilians using a deadly arsenal of 88 missiles and 66 drones -',
                title:
                  "Putin made chilling NUCLEAR threat when he emptied arsenal for biggest ever blitz...he can 'smell weakness', experts warn | The Sun",
                url: 'https://www.thesun.co.uk/news/26860486/putin-nuclear-threat-emptied-arsenal-ukraine/',
              },
              {
                date: '2024-05-07T00:00:00Z',
                snippet:
                  "The 71-year-old took the oath of office in a ceremony in the Kremlin, with several thousand people including senior Russian politicians and other high-ranking guests in attendance. Putin received 87 per cent of the vote in March's presidential election, which was overshadowed by widespread allegations of fraud, coercion and irregularities. He faced no credible opposition after his main challenger was barred from running.",
                title:
                  'Putin sworn in for 5th term as Russian president — National Accord Newspaper',
                url: 'https://www.nationalaccordnewspaper.com/putin-sworn-in-for-5th-term-as-russian-president/',
              },
              {
                date: '2024-05-27T00:00:00Z',
                snippet:
                  'Representatives of the Ministry of Foreign Affairs and the Ministry of Justice of Russia informed President Vladimir Putin that the Taliban (a terrorist organisation banned in the Russian Federation) could be excluded from the list of banned organisations. "[Removing the Taliban from the banned list] is mandatory.',
                title:
                  'Russia to remove Taliban from the list of terrorist groups in light of objective reality',
                url: 'https://english.pravda.ru/amp/news/world/159697-russia-taliban/',
              },
              {
                date: '2023-06-23T00:00:00Z',
                snippet:
                  'That Khodorkovsky would criticize the Kremlin is no surprise. He is a former oil tycoon who publicly broke with Putin in 2003 and was later arrested on tax evasion and fraud charges. He was imprisoned in Russia for 10 years and moved abroad after Putin pardoned him.',
                title:
                  'Russia-Ukraine War: Russian Generals Accuse Mercenary Leader of Trying to Mount a Coup - The New York Times',
                url: 'https://www.nytimes.com/live/2023/06/23/world/russia-ukraine-news',
              },
              {
                date: '2024-05-25T00:00:00Z',
                snippet:
                  "There's no other way to describe it. Only madmen like Putin are capable of killing and terrorizing people so despicably. We already know that there are wounded and dead.",
                title:
                  "Russian airstrike hits home improvement store in Ukraine's Kharkiv, over 200 people reportedly inside — Meduza",
                url: 'https://meduza.io/amp/en/feature/2024/05/25/russian-airstrike-hits-home-improvement-store-in-ukraine-s-kharkiv-over-200-people-reportedly-inside',
              },
              {
                date: '2024-01-24T00:00:00Z',
                snippet:
                  "But we should take a step back from Russia's multibillion-dollar propaganda machine's feedlot and look at the facts and logic. Putin has proven to be a habitual liar, a terrorist and a war criminal who can't even travel freely after being charged by the International Criminal Court for the kidnapping of Ukrainian children. It is a rather obvious question, but does a good-faith negotiation with someone who has driven a truck through multiple international agreements make sense at all?",
                title:
                  'Russian invasion: Why we should never negotiate with terrorists',
                url: 'https://www.dailymaverick.co.za/opinionista/2024-01-25-russian-invasion-why-we-should-never-negotiate-with-terrorists/',
              },
              {
                date: '2024-03-24T00:00:00Z',
                snippet:
                  'to occupying a portion of eastern and southern Ukraine, the war is grinding on with Ukraine\'s counteroffensive since last summer now struggling. Putin earlier today claimed that Ukraine had collaborated with the terrorist suspects who massacred at least 133 people on Friday night at a pop concert. Zelenskiy is now saying it was "absolutely predictable" that Putin waited until the day after, then found a way to tie the massacre to Ukraine, Reuters reports.',
                title:
                  'Some victims of Moscow shooting in critical condition, authorities say – as it happened | Moscow concert hall attack | The Guardian',
                url: 'https://www.theguardian.com/world/live/2024/mar/23/moscow-concert-attack-crocus-city-hall-shooting-russia-live-updates?filterKeyEvents=false',
              },
              {
                date: '2023-03-21T00:00:00Z',
                snippet:
                  "On March 17, The International Criminal Court (ICC) issued arrest warrants indicting the president of the Russian Federation, Vladimir Vladimirovich Putin, for alleged war crimes committed in the ongoing Russian invasion of Ukraine. The ICC announced arrest warrants for Russian president Vladimir Putin and Maria Alekseyevna Lvova-Belova, the Commissioner for Children's Rights for the Russian Federation, in light of evidence pointing that both actors are allegedly liable for the mass deportation of Ukrainian children to the Russian Federation.",
                title:
                  "The (Ukrainian) kids aren't alright: The ICC issues historic arrest warrant for Putin's war crimes on Ukrainian children | The Brock Press",
                url: 'https://brockpress.com/the-ukrainian-kids-arent-alright-the-icc-issues-historic-arrest-warrant-for-putins-war-crimes-on-ukrainian-children/',
              },
              {
                date: '2023-05-05T00:00:00Z',
                snippet:
                  'Bere Telegram kontuan argitaratutako bideo batean, «Wagnerreko borrokalarien eta komandantziaren izenean, 2023ko maiatzaren 10ean Bakhmut hiriko posizioak Defentsa Ministerioko unitateei entregatzera eta, zauriak miazkatzeko, gureak atzegoardian birkokatzera behartuta egongo gara», ohartarazi du Prigozhinek. Armadako «Estatu Nagusiko buru Valeri Gerasimovi, Defentsa ministro Sergei Shoiguri, komandanteburu Vladimir Putini eta Errusiako herriari» zuzendutako mezuan, «munizio faltarekin, mertzenarioak zentzurik gabeko heriotzara kondenatuta» daudela deitoratu du. Prigozhinek gogor jo du Xoiguren eta Gerasimoven kontra, hainbat mertzenarioren gorpuak ondoan dituela.',
                title:
                  'Wagner taldeak Bakhmutetik erretiratuko dela ohartarazi du | Mundo | GARA Euskal Herriko egunkaria',
                url: 'https://www.naiz.eus/es/hemeroteca/gara/editions/2023-05-06/hemeroteca_articles/amp/wagner-taldeak-bakhmutetik-erretiratuko-dela-ohartarazi-du',
              },
              {
                date: '2023-07-20T00:00:00Z',
                snippet:
                  'But as a member of the ICC, it is in theory obligated to execute the warrant for arrest. According to a press release issued by the ICC at the time, Putin, 70, and Lvova-Belova, 38, are "allegedly responsible for the war crime of unlawful deportation...and unlawful transfer" of children from occupied areas of Ukraine to the Russian Federation", for which they have been charged under "Articles 8(2)(a)(vii) and 8(2)(b)(viii) of the Rome Statute". The Rome Statute, adopted in 1998, is the international treaty that established the ICC.',
                title:
                  "Why Putin won't go to South Africa for the BRICS summit in August | The Indian Express",
                url: 'https://indianexpress.com/article/explained/explained-global/why-putin-wont-go-to-south-africa-for-the-brics-summit-in-august-8850401/',
              },
              {
                date: '2023-03-20T00:00:00Z',
                snippet:
                  "Formal talks were scheduled for Tuesday, the Kremlin said. Xi's visit comes three days after Putin was made the subject of an arrest warrant by the international criminal court for overseeing the abduction of Ukrainian children, sending Russia another significant step on the path to becoming a pariah state, and two days after he made a surprise visit to the occupied city of Mariupol in an apparent show of defiance towards the court and the west in general. Washington said on Monday that Xi's visit to Moscow soon after the ICC's court order amounted to Beijing providing \"diplomatic cover for Russia to continue to commit\" war crimes.",
                title:
                  "Xi Jinping says China ready to 'stand guard over world order' on Moscow visit | Russia | The Guardian",
                url: 'https://www.theguardian.com/world/2023/mar/20/xi-jinping-vladimir-putin-moscow-ukraine-war',
              },
              {
                date: '2023-04-17T00:00:00Z',
                snippet:
                  'Vladimir Kara-Murza, destacado defensor ruso de los derechos humanos y crítico con el Kremlin, fue sentenciado este lunes a 25 años de prisión por el Tribunal Municipal de Moscú tras condenar públicamente la guerra de Rusia en Ucrania. "Sobre la base de los resultados del juicio, por adición parcial de penas, Vladimir Vladimirovich Kara-Murza ha sido condenado a una pena firme de 25 años de prisión que deberá cumplir en una colonia penitenciaria de régimen estricto. El veredicto del Tribunal Municipal de Moscú aún no ha entrado en vigor", se lee en un comunicado del tribunal.',
                title:
                  'Última hora y noticias en vivo de la guerra de Rusia en Ucrania',
                url: 'https://cnnespanol.cnn.com/2023/04/17/ultima-hora-noticias-vivo-guerra-rusia-ucrania-orix-33/amp/',
              },
              {
                date: '2024-01-16T00:00:00Z',
                snippet:
                  'В отношении него составили протокол, который позднее аннулировали. После задержания Владимир Владимирович написал заявление в Центральный районный суд. Он потребовал 100 тысяч рублей за действия полицейских.',
                title:
                  'В Новосибирске скончался судившийся с МВД ветеран ВОВ Владимир Степанов | ОБЩЕСТВО | АиФ Новосибирск',
                url: 'https://nsk.aif.ru/amp/society/v_novosibirske_skonchalsya_sudivshiysya_s_mvd_veteran_vov_vladimir_stepanov',
              },
            ],
            assets: [
              {
                public_url:
                  'http://complyadvantage-asset-development.s3.amazonaws.com/3e61820f-94d2-4846-a000-923812d19c72.jpg',
                source: 'complyadvantage',
                type: 'picture',
                url: 'http://structure.mil.ru/images/putin_170x240.jpg',
              },
            ],
            source_notes: {
              'company-am': {
                aml_types: ['adverse-media', 'adverse-media-v2-other-minor'],
                country_codes: ['AU', 'CZ'],
                name: 'company AM',
              },
              complyadvantage: {
                aml_types: ['pep', 'pep-class-1'],
                country_codes: ['RU'],
                name: 'ComplyAdvantage PEP Data',
              },
            },
          },
          match_types: ['aka_exact'],
          match_types_details: [
            {
              aml_types: [
                'adverse-media',
                'adverse-media-financial-crime',
                'adverse-media-fraud',
                'adverse-media-general',
                'adverse-media-narcotics',
              ],
              matching_name: 'Vladimir Putiin',
              name_matches: [
                {
                  match_types: ['edit_distance'],
                  query_term: 'putin',
                },
              ],
              secondary_matches: [],
              sources: ['ComplyAdvantage Adverse Media'],
            },
          ],
          score: 1.7,
        },
      ],
      blacklist_hits: [],
    },
  },
}

export const MOCK_CA_SEARCH_NO_HIT_RESPONSE = {
  status: 'success',
  code: 200,
  content: {
    data: {
      id: 1051192082,
      ref: '1665008971-sY_uzk_L',
      searcher_id: 21260,
      assignee_id: 21260,
      filters: {
        country_codes: [],
        exact_match: false,
        fuzziness: 0.5,
        remove_deceased: 0,
        types: [
          'pep',
          'sanction',
          'warning',
          'fitness-probity',
          'pep-class-4',
          'pep-class-2',
          'pep-class-3',
          'pep-class-1',
        ],
      },
      match_status: 'potential_match',
      risk_level: 'unknown',
      search_term: 'Huawei',
      submitted_term: 'Huawei',
      client_ref: null,
      total_hits: 266,
      total_matches: 266,
      total_blacklist_hits: 0,
      created_at: '2022-10-05 22:29:31',
      updated_at: '2022-10-05 22:29:31',
      tags: [],
      labels: [],
      limit: 500,
      offset: 0,
      searcher: {
        id: 21260,
        email: 'chia@flagright.com',
        name: 'Chia-Lun Wu',
        phone: null,
        created_at: '2022-05-17 07:48:50',
        user_is_active: true,
      },
      assignee: {
        id: 21260,
        email: 'chia@flagright.com',
        name: 'Chia-Lun Wu',
        phone: null,
        created_at: '2022-05-17 07:48:50',
        user_is_active: true,
      },
      hits: [],
      blacklist_hits: [],
    },
  },
}
