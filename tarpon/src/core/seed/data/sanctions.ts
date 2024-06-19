import { memoize } from 'lodash'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'

export const getSanctions: () => SanctionsSearchHistory[] = memoize(() => {
  return []
})

export const getSanctionsHits: () => SanctionsHit[] = memoize(() => {
  return []
})
