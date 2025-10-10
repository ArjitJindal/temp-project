import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { ReportSubjectType } from '@/@types/openapi-internal/ReportSubjectType'

// maually wrote sar countries as they are imported in sar detail logic.
// the earlier implementation imports the generators for sar along with their schema which increases the build size
// now when we implement new sar genearator we need to cross check this variable

export const UNIMPLEMENTED_GENERATORS: [
  CountryCode,
  string,
  ReportSubjectType[]
][] = [
  ['KE', 'STR', []],
  ['CA', 'LCTR', ['CASE']],
  ['CA', 'AMF', ['CASE']],
  ['CA', 'Terrorist Property Report', ['CASE']],
]
