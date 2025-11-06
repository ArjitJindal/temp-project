// Base PEP type mappings
const BASE_PEP_MAPPINGS: Record<string, string> = {
  'PEP IO': 'International organization',
  'PEP RO': 'Regional organization',
  'PEP N': 'National government',
  'PEP SN': 'Sub-national government',
  'PEP L': 'Local government',
  'PEP NG': 'Non-governmental organization',
}

// Suffixes for relative and associate variants
const ASSOCIATE_VARIANTS = ['-R', '-A'] as const

// Generate EXTERNAL_TO_INTERNAL_MAPPINGS with base types and variants
export const EXTERNAL_TO_INTERNAL_MAPPINGS: Record<string, string> = {
  ...BASE_PEP_MAPPINGS,
  // Generate variants (-R and -A) for each base PEP type
  ...Object.fromEntries(
    Object.entries(BASE_PEP_MAPPINGS).flatMap(([key, value]) =>
      ASSOCIATE_VARIANTS.map((suffix) => [`${key}${suffix}`, value])
    )
  ),
  // Additional types without variants
  SOE: 'State owned enterprise',
  SIE: 'State invested enterprise',
}

// Generate RELATIVE_OR_CLOSE_ASSOCIATE_TYPES from base PEP mappings
export const RELATIVE_OR_CLOSE_ASSOCIATE_TYPES: string[] = Object.keys(
  BASE_PEP_MAPPINGS
).flatMap((key) => ASSOCIATE_VARIANTS.map((suffix) => `${key}${suffix}`))
