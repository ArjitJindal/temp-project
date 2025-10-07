import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import {
  DEFAULT_CLOSURE_REASONS,
  DEFAULT_ESCALATION_REASONS,
  getDefaultReasonsData,
} from '@/services/tenants/reasons-service'
import { logger } from '@/core/logger'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { ReasonsRepository } from '@/services/tenants/repositories/reasons/reasons-repository'
import { CounterRepository } from '@/services/counter/repository'
import { envIs } from '@/utils/env'

async function migrateTenant(tenant: Tenant) {
  if (tenant.id === 'gocardless_poc' && envIs('sandbox')) {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const reasonsRepository = new ReasonsRepository(tenant.id, {
      mongoDb,
      dynamoDb,
    })
    const counterRepository = new CounterRepository(tenant.id, {
      mongoDb,
      dynamoDb,
    })
    const existingReasons = await reasonsRepository.getReasons()
    const existingClosureReasons = existingReasons.filter(
      (reason) => reason.reasonType === 'CLOSURE'
    )
    const existingEscalationReasons = existingReasons.filter(
      (reason) => reason.reasonType === 'ESCALATION'
    )
    const defaultReasons = getDefaultReasonsData()
    await Promise.all([
      reasonsRepository.bulkAddReasons(defaultReasons),
      counterRepository.setCounterValue(
        'EscalationReason',
        DEFAULT_ESCALATION_REASONS.length + existingEscalationReasons.length
      ),
      counterRepository.setCounterValue(
        'ClosureReason',
        DEFAULT_CLOSURE_REASONS.length + existingClosureReasons.length
      ),
    ])
    logger.info(`Stored default reasons for tenant ${tenant.name} `)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
