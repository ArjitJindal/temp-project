import omit from 'lodash/omit'
import { backOff } from 'exponential-backoff'
import pMap from 'p-map'
import { logger } from '../logger'
import { VersionHistoryTable } from '../../models/version-history'
import { getCases } from './data/cases'
import { getCrmRecords, getCrmUserRecordLinks } from './data/crm-records'
import { auditlogs } from './data/auditlogs'
import { getQASamples } from './samplers/qa-samples'
import { getSanctionsScreeningDetails } from './data/sanctions'
import { data as krsAndDrsScoreData } from './data/risk-scores'
import { reports } from './data/reports'
import { getNotifications } from './data/notifications'
import { users } from './data/users'
import { getUserEvents } from './data/user_events'
import { getArsScores } from './data/ars_scores'
import { getTransactions } from './data/transactions'
import {
  CLICKHOUSE_DEFINITIONS,
  CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO,
  ClickHouseTables,
} from '@/utils/clickhouse/definition'
import {
  batchInsertToClickhouse,
  createTenantDatabase,
  isClickhouseEnabledInRegion,
  getClickhouseClient,
  syncThunderSchemaTables,
} from '@/utils/clickhouse/utils'
import { MongoDbConsumer } from '@/lambdas/mongo-db-trigger-consumer'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'

import { data as transactionEvents } from '@/core/seed/data/transaction_events'

const collections: [string, () => unknown[]][] = [
  [CLICKHOUSE_DEFINITIONS.ALERTS_QA_SAMPLING.tableName, () => getQASamples()],
  [
    CLICKHOUSE_DEFINITIONS.SANCTIONS_SCREENING_DETAILS.tableName,
    () => getSanctionsScreeningDetails(),
  ],
  [CLICKHOUSE_DEFINITIONS.KRS_SCORE.tableName, () => krsAndDrsScoreData()[0]],
  [CLICKHOUSE_DEFINITIONS.DRS_SCORE.tableName, () => krsAndDrsScoreData()[1]],
  [CLICKHOUSE_DEFINITIONS.REPORTS.tableName, () => reports],
  [CLICKHOUSE_DEFINITIONS.NOTIFICATIONS.tableName, () => getNotifications()],
  [CLICKHOUSE_DEFINITIONS.USERS.tableName, () => users],
  [CLICKHOUSE_DEFINITIONS.CASES.tableName, () => getCases()],
  [CLICKHOUSE_DEFINITIONS.USER_EVENTS.tableName, () => getUserEvents()],
  [CLICKHOUSE_DEFINITIONS.ARS_SCORE.tableName, () => getArsScores()],
  [
    CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName,
    () => transactionEvents(),
  ],
  [CLICKHOUSE_DEFINITIONS.TRANSACTIONS.tableName, () => getTransactions()],
  [
    CLICKHOUSE_DEFINITIONS.ALERTS.tableName,
    () => {
      const data = getCases()
      const alerts = data
        .map((c) =>
          c.alerts?.map((a) => ({
            ...a,
            caseStatus: c.caseStatus,
          }))
        )
        .flatMap((a) => a)
      return alerts
    },
  ],
  [
    CLICKHOUSE_DEFINITIONS.CASES_V2.tableName,
    () => {
      const data = getCases()
      const cases = data.map((c) => omit(c, 'alerts', 'comments'))
      return cases
    },
  ],
  [CLICKHOUSE_DEFINITIONS.CRM_RECORDS.tableName, () => getCrmRecords()],
  [
    CLICKHOUSE_DEFINITIONS.CRM_USER_RECORD_LINK.tableName,
    () => getCrmUserRecordLinks(),
  ],
  [CLICKHOUSE_DEFINITIONS.AUDIT_LOGS.tableName, () => auditlogs()],
]

export const seedClickhouse = async (tenantId: string) => {
  const client = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  await syncThunderSchemaTables(tenantId)
  let now = Date.now()

  if (isClickhouseEnabledInRegion()) {
    const clickhouseClient = await getClickhouseClient(tenantId, {
      requestTimeout: 300_000,
      keepAlive: true,
    })
    const versionHistoryTableName =
      VersionHistoryTable.tableDefinition.tableName

    const tablesToDelete = [
      versionHistoryTableName,
      ...ClickHouseTables.map((table) => table.table),
    ]

    now = Date.now()
    await pMap(
      tablesToDelete,
      async (table) => {
        const now = Date.now()
        await backOff(
          async () => {
            try {
              await clickhouseClient.exec({
                query: `TRUNCATE TABLE IF EXISTS ${table}`,
                clickhouse_settings: {
                  max_execution_time: 120,
                  send_timeout: 60,
                  receive_timeout: 60,
                },
              })
            } catch (error) {
              // error code 60 is returned when the table does not exist
              // error code 81 is returned when the database does not exist
              if (
                error instanceof Error &&
                'code' in error &&
                (error.code == 60 || error.code == 81)
              ) {
                logger.warn(`Table ${table} does not exist`)
                return // Don't throw for non-existent tables
              } else {
                // Enhanced timeout error detection
                const isTimeoutError =
                  error instanceof Error &&
                  (error.message.includes('Timeout') ||
                    error.message.includes('timeout') ||
                    error.message.includes('TIMEOUT') ||
                    error.message.includes('Connection timeout') ||
                    error.message.includes('Request timeout') ||
                    error.message.includes('Socket timeout') ||
                    (error as any).code === 'ETIMEDOUT' ||
                    (error as any).code === 'ECONNRESET' ||
                    (error as any).code === 'ENOTFOUND')

                if (isTimeoutError) {
                  logger.warn(
                    `Timeout error occurred for table ${table}, retrying: ${error.message}`
                  )
                } else {
                  logger.warn(`Non-timeout error for table ${table}: ${error}`)
                }

                throw error
              }
            }
          },
          {
            numOfAttempts: 5, // Increased from 3
            delayFirstAttempt: true, // Add initial delay
            startingDelay: 1000, // 1 second initial delay
            timeMultiple: 2, // Exponential backoff
            maxDelay: 30000, // Max 30 seconds between retries
            retry: (e, attemptNumber) => {
              const isTimeoutError =
                e instanceof Error &&
                (e.message.includes('Timeout') ||
                  e.message.includes('timeout') ||
                  (e as any).code === 'ETIMEDOUT')

              logger.warn(
                `Clickhouse: retrying deletion of ${table}, attempt ${attemptNumber}/5`,
                {
                  error: e.message,
                  isTimeoutError,
                  table,
                  attemptNumber,
                }
              )

              return true
            },
          }
        )

        logger.info(
          `TIME: Clickhouse: ${table} deletion took ~ ${Date.now() - now}ms`
        )
      },
      { concurrency: 5 }
    )
    logger.info(`TIME: Clickhouse: table deletion took ~ ${Date.now() - now}`)

    const mongoConsumerService = new MongoDbConsumer(client, dynamoDb)
    now = Date.now()
    await createTenantDatabase(tenantId)
    logger.info(
      `TIME: Clickhouse: Tenant database creation took ~ ${Date.now() - now}`
    )
    now = Date.now()
    await pMap(
      collections,
      async (collection) => {
        const [clickhouseTable, dataFn] = collection
        const data = dataFn()

        const mongoTable =
          CLICKHOUSE_TABLE_SUFFIX_MAP_TO_MONGO()[clickhouseTable]

        let dataArray: any[] = []
        const now = Date.now()
        for (const dataChunk of data) {
          dataArray.push(dataChunk)
          if (dataArray.length === 100) {
            const updatedData = await mongoConsumerService.updateInsertMessages(
              mongoTable,
              dataArray
            )
            await batchInsertToClickhouse(
              tenantId,
              clickhouseTable,
              updatedData
            )
            dataArray = []
          }
        }
        if (dataArray.length > 0) {
          const updatedData = await mongoConsumerService.updateInsertMessages(
            mongoTable,
            dataArray
          )
          await batchInsertToClickhouse(tenantId, clickhouseTable, updatedData)
        }
        logger.info(
          `TIME: Clickhouse: ${clickhouseTable} sync took ~ ${Date.now() - now}`
        )
      },
      { concurrency: 5 }
    )
    logger.info(`TIME: Clickhouse: data sync took ~ ${Date.now() - now}`)
  }
}
