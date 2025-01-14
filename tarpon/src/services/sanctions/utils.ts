import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { hasFeature } from '@/core/utils/context'

export function getDefaultProvider(): SanctionsDataProviderName {
  if (hasFeature('DOW_JONES')) {
    return 'dowjones'
  }
  if (hasFeature('OPEN_SANCTIONS')) {
    return 'open-sanctions'
  }
  if (hasFeature('ACURIS')) {
    return 'acuris'
  }
  return 'comply-advantage'
}
