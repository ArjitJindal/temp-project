import { memoize } from 'lodash'
import { getCases } from './cases'
import { getReports } from './reports'
import { ruleInstances } from './rules'
import { getAlerts } from '@/core/seed/samplers/cases'
import { getQASamples } from '@/core/seed/samplers/qa-samples'
import { EntityCounter } from '@/services/counter/repository'

export const getCounterCollectionData: () => EntityCounter[] = memoize(() => {
  return [
    {
      entity: 'Case',
      count: getCases().length + 1,
    },
    {
      entity: 'Alert',
      count: getAlerts().length + 1,
    },
    {
      entity: 'AlertQASample',
      count: getQASamples().length + 1,
    },
    {
      entity: 'Report',
      count: getReports().length + 1,
    },
    {
      entity: 'RC',
      count: ruleInstances().length + 1,
    },
  ]
})
