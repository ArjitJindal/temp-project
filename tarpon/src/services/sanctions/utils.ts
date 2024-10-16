import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { hasFeature } from '@/core/utils/context'

export function getDefaultProvider(): SanctionsDataProviderName {
  return hasFeature('DOW_JONES') ? 'dowjones' : 'comply-advantage'
}
