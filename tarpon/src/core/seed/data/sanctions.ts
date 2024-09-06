import { memoize } from 'lodash'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'

// TODO: FR-5509 add sanctions data
export const getSanctions: () => SanctionsSearchHistory[] = memoize(() => {
  return []
})

// TODO: FR-5509 add sanctions hits data
export const getSanctionsHits: () => SanctionsHit[] = memoize(() => {
  return []
})
