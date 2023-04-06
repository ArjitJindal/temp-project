import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { replayTransactionsAndEvents } from '../utils/transaction'
import { Tenant } from '@/services/accounts'

// The start time of the deployment - https://flagright.slack.com/archives/C03L5KRE2E8/p1680693627579059
const AFFECTECT_FROM_TIMESTAMP = new Date('2023-04-05T11:20:00.000Z').valueOf()
// The end time of the deployment - https://flagright.slack.com/archives/C03L5KRE2E8/p1680792243747589 (https://github.com/flagright/tarpon/pull/1163)
const AFFECTECT_TO_TIMESTAMP = new Date('2023-04-06T14:41:00.000Z').valueOf()

async function migrateTenant(tenant: Tenant, migrationKey: string) {
  await replayTransactionsAndEvents(
    tenant.id,
    AFFECTECT_FROM_TIMESTAMP,
    AFFECTECT_TO_TIMESTAMP,
    migrationKey
  )
}

export const up = async () => {
  await migrateAllTenants((tenant) =>
    migrateTenant(
      tenant,
      `2023.04.06T09.32.44.re-verify-transactions-${tenant.id}`
    )
  )
}
export const down = async () => {
  // skip
}
