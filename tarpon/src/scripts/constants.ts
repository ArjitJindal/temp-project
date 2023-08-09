import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'

export const currencies: CurrencyCode[] = [
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'INR',
  'TWD',
  'RUB',
  'SGD',
  'TRY',
]

export const countries: CountryCode[] = [
  'US',
  'DE',
  'JP',
  'GB',
  'IN',
  'TW',
  'RU',
  'SG',
  'TR',
]

export const businessIndustries = [
  'farming',
  'gambling',
  'crypto',
  'retail_clothing',
  'construction',
  'logistics',
  'tourism',
  'software',
  'services',
  'retail_groceries',
  'retail_electronics',
]

export const businessIndustryMainProducts: { [key: string]: string[] } = {
  farming: ['hazelnut', 'rice', 'food', 'wheat', 'vegetables'],
  gambling: ['sports', 'casino', 'generic'],
  crypto: ['defi', 'trading', 'options', 'nft'],
  retail_clothing: ['clothes', 'accessories', 'electronics'],
  construction: ['building_services', 'building_materials', 'equipment_share'],
  logistics: ['transportation', 'warehousing', 'freight_forwarding', 'customs'],
  tourism: ['tours', 'souvenir', 'booking', 'agency'],
  software: ['saas', 'it_services', 'bpo'],
  services: ['plumbing', 'cleaning', 'storage', 'design'],
  retail_groceries: ['groceries', 'fmcg'],
  retail_electronics: ['computers', 'smartphones', 'speakers'],
}

export const documentTypes = [
  'passport',
  'drivers_license',
  'national_id',
  'birth_certificate',
  'residence_permit',
  'visa',
  'insurance_card',
]

export const ruleInstances: ExecutedRulesResult[] = [
  {
    ruleId: 'R-1',
    ruleInstanceId: '1',
    ruleName: 'First payment of a Customer',
    ruleDescription: 'First transaction of a user',
    ruleAction: 'FLAG',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-2',
    ruleInstanceId: '2',
    ruleName: 'Transaction amount too high',
    ruleDescription: 'Transaction amount is >= x in USD or equivalent',
    ruleAction: 'BLOCK',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-3',
    ruleInstanceId: '3',
    ruleName: 'Unexpected origin or destination country',
    ruleDescription:
      'Transaction to or from a country that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between countries.',
    ruleAction: 'BLOCK',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-4',
    ruleInstanceId: '4',
    ruleName: ' Unexpected origin or destination currency',
    ruleDescription:
      'Transaction to or from a currency that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between different currencies.',
    ruleAction: 'BLOCK',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-4',
    ruleInstanceId: '5',
    ruleName: 'Unexpected origin or destination currency',
    ruleDescription:
      'Transaction to or from a currency that has not been used before by this user. Trigger the rule after x transactions have been completed. x configurable - mostly relevant for when you are moving between different currencies.',
    ruleAction: 'BLOCK',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-5',
    ruleInstanceId: '6',
    ruleName: 'Dormant Accounts',
    ruleDescription:
      'If a user has made a transaction after being inactive for time t, block user & transactions.',
    ruleAction: 'BLOCK',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-6',
    ruleInstanceId: '7',
    ruleName: 'High risk currency',
    ruleDescription:
      'Transaction includes a currency that is designated as high risk. Mostly relevant for when you are moving funds between different currencies. This rule uses a customizable list.',
    ruleAction: 'BLOCK',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-7',
    ruleInstanceId: '8',
    ruleName: 'Too many inbound transactions under reporting limit',
    ruleDescription:
      '>= x number of low value incoming transactions just below (minus amount of z) a specific threshold (y) to a user (your user is receiving the funds). Very useful and common for structured money laundering attempts. ',
    ruleAction: 'FLAG',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-8',
    ruleInstanceId: '9',
    ruleName: 'Too many outbound transactions under reporting limit',
    ruleDescription:
      '>= x number of low value outgoing transactions just below (minus amount of z) a specific threshold (y) from a user (your user is sending the funds). Very useful and common for structured money laundering attempts.',
    ruleAction: 'FLAG',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-9',
    ruleInstanceId: '10',
    ruleName: 'Too many customers for a single counterparty',
    ruleDescription:
      'More than x users transacting with a single counterparty over a set period of time t (E.g. Nigerian prince scam outbound)',
    ruleAction: 'FLAG',
    ruleHit: Math.random() < 0.5,
  },
  {
    ruleId: 'R-10',
    ruleInstanceId: '11',
    ruleName: 'Too many counterparties for a single customer',
    ruleDescription:
      'More than x counterparties transacting with a single user over a set period of time t (E.g. Nigerian prince scam inbound)',
    ruleAction: 'FLAG',
    ruleHit: Math.random() < 0.5,
  },
]
