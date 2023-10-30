import { memoize } from 'lodash'
import { SanctionsSearchHistory } from '@/@types/openapi-internal/SanctionsSearchHistory'

export const getSanctions: () => SanctionsSearchHistory[] = memoize(() => {
  return []
})
