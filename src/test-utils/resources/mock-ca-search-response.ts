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
