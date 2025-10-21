import { PepRank } from '@/@types/openapi-internal/PepRank'
import { OccupationCode } from '@/@types/openapi-internal/OccupationCode'
import { DowJonesAdverseMediaSourceRelevance } from '@/@types/openapi-internal/DowJonesAdverseMediaSourceRelevance'

// Define the API endpoint
export const apiEndpoint = 'https://djrcfeed.dowjones.com/xml'

export const PEP_RANK_DISTRIBUTION_BY_OCCUPATION_CODE: Record<
  string,
  {
    rank: PepRank
    occupationCode: OccupationCode
  }
> = {
  16: {
    rank: 'LEVEL_1',
    occupationCode: 'political_party_officials',
  },
  1: {
    rank: 'LEVEL_1',
    occupationCode: 'heads_and_deputies_state_national_government',
  },
  2: {
    rank: 'LEVEL_1',
    occupationCode: 'national_government_ministers',
  },
  3: {
    rank: 'LEVEL_1',
    occupationCode: 'members_of_the_national_legislature',
  },
  4: {
    rank: 'LEVEL_1',
    occupationCode: 'senior_civil_servants_national_government',
  },
  5: {
    rank: 'LEVEL_1',
    occupationCode: 'senior_civil_servants_regional_government',
  },
  7: {
    rank: 'LEVEL_1',
    occupationCode: 'senior_members_of_the_armed_forces',
  },
  8: {
    rank: 'LEVEL_1',
    occupationCode: 'senior_members_of_the_police_service',
  },
  9: {
    rank: 'LEVEL_1',
    occupationCode: 'senior_members_of_the_secret_services',
  },
  10: {
    rank: 'LEVEL_1',
    occupationCode: 'senior_members_of_the_judiciary',
  },
  18: {
    rank: 'LEVEL_1',
    occupationCode: 'city_mayors',
  },
  22: {
    rank: 'LEVEL_1',
    occupationCode: 'local_public_officials',
  },
  12: {
    rank: 'LEVEL_1',
    occupationCode: 'state_agency_officials',
  },
  13: {
    rank: 'LEVEL_1',
    occupationCode: 'heads_and_deputy_heads_regional_government',
  },
  14: {
    rank: 'LEVEL_1',
    occupationCode: 'regional_government_ministers',
  },
  11: {
    rank: 'LEVEL_2',
    occupationCode: 'state_corporation_executives',
  },
  6: {
    rank: 'LEVEL_2',
    occupationCode: 'embassy_consular_staff',
  },
  15: {
    rank: 'LEVEL_2',
    occupationCode: 'religious_leaders',
  },
  17: {
    rank: 'LEVEL_2',
    occupationCode: 'international_organisation_officials',
  },
  19: {
    rank: 'LEVEL_2',
    occupationCode: 'political_pressure_labour_group_officials',
  },
  26: {
    rank: 'LEVEL_2',
    occupationCode: 'international_sporting_organisation_officials',
  },
  20: {
    rank: 'LEVEL_3',
    occupationCode: 'other',
  },
}

export const NATIONALITY_COUNTRY_TYPE = [
  'Citizenship',
  'Resident of',
  'Country of Registration',
  'Jurisdiction',
]

export const RELATIONSHIP_CODE_TO_NAME: Record<string | number, string> = {}

export const ADVERSE_MEDIA_DESCRIPTION3_VALUES = [
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '21',
  '31',
  '39',
  '40',
]

export const PERSON_ADVERSE_MEDIA_DESCRIPTION2_IDS = [
  '6', // Terror
  '7', // Organised Crime
  '8', // Financial Crime
  '9', // Trafficking
  '10', // Corruption
  '11', // War Crimes
  '21', // Organised Crime Japan
  '24', // Enhanced Country Risk
  '31', // Tax Crime
  '39', // Child Sexual Exploitation
]

export const ENTITY_ADVERSE_MEDIA_DESCRIPTION2_IDS = [
  '12', // Terror
  '13', // Organised Crime
  '14', // Financial Crime
  '15', // Trafficking
  '16', // War Crimes
  '17', // Corruption
  '22', // Organised Crime Japan
  '23', // Enhanced Country Risk
]

// Mapping from description2 IDs to DowJonesAdverseMediaSourceRelevance enum values
export const ADVERSE_MEDIA_ID_TO_DESCRIPTION_MAP: Record<
  string,
  DowJonesAdverseMediaSourceRelevance
> = {
  '6': 'TERROR', // Person - Terror
  '7': 'ORGANISED_CRIME', // Person - Organised Crime
  '8': 'FINANCIAL_CRIME', // Person - Financial Crime
  '9': 'TRAFFICKING', // Person - Trafficking
  '10': 'CORRUPTION', // Person - Corruption
  '11': 'WAR_CRIMES', // Person - War Crimes
  '21': 'ORGANISED_CRIME_JAPAN', // Person - Organised Crime Japan
  '24': 'ENHANCED_COUNTRY_RISK', // Person - Enhanced Country Risk
  '31': 'TAX_CRIME', // Person - Tax Crime
  '12': 'TERROR', // Entity - Terror
  '13': 'ORGANISED_CRIME', // Entity - Organised Crime
  '14': 'FINANCIAL_CRIME', // Entity - Financial Crime
  '15': 'TRAFFICKING', // Entity - Trafficking
  '16': 'WAR_CRIMES', // Entity - War Crimes
  '17': 'CORRUPTION', // Entity - Corruption
  '22': 'ORGANISED_CRIME_JAPAN', // Entity - Organised Crime Japan
  '23': 'ENHANCED_COUNTRY_RISK', // Entity - Enhanced Country Risk
  '39': 'CHILD_SEXUAL_EXPLOITATION', // Entity - Child Sexual Exploitation
}

export const FLOATING_CATEGORIES_DESCRIPTION_VALUES = [
  '12',
  '13',
  '14',
  '15',
  '17',
  '22',
]

export const NON_BUSINESS_CATEGORIES_DESCRIPTION_VALUES = [
  '1',
  '10',
  '3',
  '12',
  '9',
  '18',
  '49',
  '47',
  '50',
]

export const LEVEL_TIER_MAP = {
  LEVEL_1: 'PEP Tier 1',
  LEVEL_2: 'PEP Tier 2',
  LEVEL_3: 'PEP Tier 3',
  PEP_BY_ASSOCIATIONS: 'PEP by Associations',
}

export const SANCTIONS_CATEGORY_MAP = {
  current: 'CURRENT',
  suspended: 'FORMER',
}

export const ENTITY_SANCTIONS_DESCRIPTION2_VALUES = ['3', '4', '34']
export const PERSON_SANCTIONS_DESCRIPTION2_VALUES = ['1', '2', '25']

export const BANK_DESCRIPTION3_VALUES = ['3', '12']

export const ENTITY_ADVERSE_MEDIA_DESCRIPTION2_VALUES = ['27', '28', '29', '30']
