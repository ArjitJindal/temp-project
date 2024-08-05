import { migrateAllTenants } from '../utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { Tenant } from '@/services/accounts'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import dayjs from '@/utils/dayjs'

async function migrateTenant(tenant: Tenant) {
  // 2c2p
  // context: https://flagright.slack.com/archives/C0632BHGN8G/p1721923761848289
  if (tenant.id === '52f4662976') {
    await sendBatchJobCommand({
      type: 'REVERIFY_TRANSACTIONS',
      tenantId: tenant.id,
      parameters: {
        afterTimestamp: dayjs('2024-07-24T22:00:00.000Z').valueOf(),
        beforeTimestamp: dayjs('2024-07-30T12:20:00.000Z').valueOf(),
        ruleInstanceIds: ['R-30.2', 'R-123.1'],
        extraFilter: {
          executedRules: {
            $not: {
              $elemMatch: {
                ruleInstanceId: {
                  $in: ['R-30.2', 'R-123.1'],
                },
              },
            },
          },
        },
      },
    })
  }

  // hitpaysg, seis
  // context: https://flagright.slack.com/archives/C03BN4GQALA/p1722238864520759
  if (tenant.id === '3227d9c851' || tenant.id === '1PA0RZ0DON') {
    const ruleInstanceRepo = new RuleInstanceRepository(tenant.id, {
      dynamoDb: getDynamoDbClient(),
    })
    const targetRuleInstanceIds = (
      await ruleInstanceRepo.getActiveRuleInstances()
    )
      .filter((r) =>
        r.logicAggregationVariables?.find((v) =>
          JSON.stringify(v.filtersLogic)?.includes('TRANSACTION_EVENT')
        )
      )
      .map((r) => r.id as string)
    if (targetRuleInstanceIds.length) {
      await sendBatchJobCommand({
        type: 'REVERIFY_TRANSACTIONS',
        tenantId: tenant.id,
        parameters: {
          afterTimestamp: dayjs('2024-07-04T05:48:41.364Z').valueOf(),
          beforeTimestamp: dayjs('2024-08-01T09:01:00.000Z').valueOf(),
          ruleInstanceIds: targetRuleInstanceIds,
        },
      })
    }
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
