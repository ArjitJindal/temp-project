export const currencies: string[] = [
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'INR',
  'NTD',
  'RUB',
  'SGD',
  'TRY',
]

export const countries: string[] = [
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
