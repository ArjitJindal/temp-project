import memoize from 'lodash/memoize'
import { getCases } from './cases'

export const getAlerts = memoize(() => {
  const cases = getCases()
  const alerts = cases.flatMap((case_) => case_?.alerts ?? [])

  return alerts
})
