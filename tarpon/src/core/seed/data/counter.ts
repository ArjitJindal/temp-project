import memoize from 'lodash/memoize'
import { getCases } from './cases'
import { reports } from './reports'
import { ruleInstances } from './rules'
import { riskFactors } from './risk-factors'
import { ID_PREFIXES } from './seeds'
import { getSLAPolicies } from './sla'
import { CounterEntity } from '@/services/counter/repository'
import { CASES_COLLECTION, REPORT_COLLECTION } from '@/utils/mongo-table-names'
import { Alert } from '@/@types/openapi-internal/Alert'
import { RISK_FACTORS } from '@/services/risk-scoring/risk-factors'
import {
  DEFAULT_CLOSURE_REASONS,
  DEFAULT_ESCALATION_REASONS,
} from '@/services/tenants/reasons-service'
import { isV2RuleInstance } from '@/services/rules-engine/utils'
import { logger } from '@/core/logger'

export const getCounterCollectionData: (
  tenantId: string
) => [CounterEntity, number][] = memoize((tenantId: string) => {
  return [
    [
      'Report',
      getCounterValue(
        reports,
        'id',
        ID_PREFIXES.REPORT,
        REPORT_COLLECTION(tenantId)
      ),
    ],
    [
      'Case',
      getCounterValue(
        getCases(),
        'caseId',
        ID_PREFIXES.CASE,
        CASES_COLLECTION(tenantId)
      ),
    ],
    [
      'Alert',
      getCounterValue(
        getCases()
          .flatMap((c) => c.alerts)
          .filter(Boolean) as Alert[],
        'alertId',
        ID_PREFIXES.ALERT,
        CASES_COLLECTION(tenantId) + 'Alerts'
      ),
    ],
    ['SLAPolicy', getSLAPolicies().length],
    [
      'RiskFactor',
      getCounterValue(
        riskFactors(),
        'id',
        ID_PREFIXES.RISK_FACTOR,
        'RiskFactor'
      ) + RISK_FACTORS.length,
    ],
    ['ClosureReason', DEFAULT_CLOSURE_REASONS.length],
    ['EscalationReason', DEFAULT_ESCALATION_REASONS.length],
    [
      'RC',
      ruleInstances().filter((instance) => !isV2RuleInstance(instance)).length,
    ],
  ]
})
const getCounterValue = (
  data: object[],
  idField: string,
  idPrefix: string,
  collectionName: string
) => {
  let maxId = 0
  let erroredRow = 0

  for (const row of data) {
    const id = row[idField]
    if (id.startsWith(idPrefix)) {
      const idValue = id.slice(idPrefix.length)
      const idNumber = parseInt(idValue)
      if (isNaN(idNumber)) {
        erroredRow++
      }
      maxId = Math.max(maxId, idNumber)
    } else {
      erroredRow++
    }
  }

  if (erroredRow > 0) {
    logger.warn(
      `Found ${erroredRow} errored rows in ${collectionName} with id field ${idField} and id prefix ${idPrefix}`
    )
  }

  logger.info(`Counter for ${collectionName} is ${maxId + erroredRow}`)

  return maxId + erroredRow
}
