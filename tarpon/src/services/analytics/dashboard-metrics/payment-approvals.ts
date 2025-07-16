import {
  executeClickhouseQuery,
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { DashboardStatsPaymentApprovals } from '@/@types/openapi-internal/DashboardStatsPaymentApprovals'
import { CLICKHOUSE_DEFINITIONS } from '@/utils/clickhouse/definition'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { TRANSACTION_EVENTS_COLLECTION } from '@/utils/mongodb-definitions'

const transactionStates = [
  'CREATED',
  'PROCESSING',
  'SENT',
  'EXPIRED',
  'DECLINED',
  'SUSPENDED',
  'REFUNDED',
  'SUCCESSFUL',
  'REVERSED',
]
export class PaymentApprovalsDashboardMetric {
  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsPaymentApprovals[]> {
    if (isClickhouseEnabled()) {
      return this.getClickhouseData(tenantId, startTimestamp, endTimestamp)
    }
    return this.getPaymentApprovalsStatistics(
      tenantId,
      startTimestamp,
      endTimestamp
    )
  }
  public static async getPaymentApprovalsStatistics(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsPaymentApprovals[]> {
    const pipeline = [
      {
        $match: {
          $and: [
            startTimestamp ? { createdAt: { $gte: startTimestamp } } : {},
            endTimestamp ? { createdAt: { $lte: endTimestamp } } : {},
            {
              $or: [
                {
                  transactionState: { $in: transactionStates },
                },
                { status: { $in: ['ALLOW', 'BLOCK'] } },
              ],
            },
          ],
        },
      },
      {
        $facet: {
          createdEvents: [
            {
              $match: { transactionState: { $in: transactionStates } },
            },
            {
              $group: {
                _id: '$transactionId',
                createdAt: { $min: '$createdAt' },
              },
            },
          ],
          decisionEvents: [
            {
              $match: {
                status: { $in: ['ALLOW', 'BLOCK'] },
                createdBy: { $exists: true },
              },
            },
            {
              $project: {
                transactionId: 1,
                createdBy: 1,
                createdAt: 1,
                status: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          events: {
            $concatArrays: [
              {
                $map: {
                  input: '$createdEvents',
                  as: 'created',
                  in: {
                    transactionId: '$$created._id',
                    type: 'created',
                    createdAt: '$$created.createdAt',
                  },
                },
              },
              {
                $map: {
                  input: '$decisionEvents',
                  as: 'decision',
                  in: {
                    transactionId: '$$decision.transactionId',
                    type: 'decision',
                    createdBy: '$$decision.createdBy',
                    createdAt: '$$decision.createdAt',
                    status: '$$decision.status',
                  },
                },
              },
            ],
          },
        },
      },
      {
        $unwind: '$events',
      },
      {
        $replaceRoot: { newRoot: '$events' },
      },
      {
        $group: {
          _id: '$transactionId',
          createdEvent: {
            $first: {
              $cond: [
                { $eq: ['$type', 'created'] },
                { createdAt: '$createdAt' },
                null,
              ],
            },
          },
          decisionEvents: {
            $push: {
              $cond: [
                { $eq: ['$type', 'decision'] },
                {
                  createdBy: '$createdBy',
                  createdAt: '$createdAt',
                  status: '$status',
                },
                null,
              ],
            },
          },
        },
      },
      {
        $project: {
          transactionId: '$_id',
          createdEvent: 1,
          decisionEvents: {
            $filter: {
              input: '$decisionEvents',
              cond: { $ne: ['$$this', null] },
            },
          },
        },
      },
      {
        $unwind: '$decisionEvents',
      },
      {
        $match: {
          createdEvent: { $exists: true, $ne: null },
          'decisionEvents.createdBy': { $exists: true },
        },
      },
      {
        $project: {
          decidedBy: '$decisionEvents.createdBy',
          duration: {
            $subtract: ['$decisionEvents.createdAt', '$createdEvent.createdAt'],
          },
          status: '$decisionEvents.status',
        },
      },
      {
        $group: {
          _id: '$decidedBy',
          averageDecisionTime: { $avg: '$duration' },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'ALLOW'] }, 1, 0] },
          },
          blocked: {
            $sum: { $cond: [{ $eq: ['$status', 'BLOCK'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          accountId: '$_id',
          averageDecisionTime: 1,
          approved: 1,
          blocked: 1,
        },
      },
      {
        $sort: { averageDecisionTime: 1 },
      },
    ]
    const db = await getMongoDbClientDb()
    const colectionName = TRANSACTION_EVENTS_COLLECTION(tenantId)
    const collection = db.collection(colectionName)
    const result = await collection
      .aggregate<DashboardStatsPaymentApprovals>(pipeline, {
        allowDiskUse: true,
      })
      .toArray()
    return result
  }
  public static async getClickhouseData(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsPaymentApprovals[]> {
    const clickhouseClient = await getClickhouseClient(tenantId)
    const transaction_events =
      CLICKHOUSE_DEFINITIONS.TRANSACTION_EVENTS.tableName
    const dateConditions: string[] = []
    if (startTimestamp) {
      dateConditions.push(`createdAt >= ${startTimestamp}`)
    }
    if (endTimestamp) {
      dateConditions.push(`createdAt <= ${endTimestamp}`)
    }
    const query = `
    WITH created_events AS (
    SELECT
        transactionId,
        MIN(createdAt) AS created_at
    FROM ${transaction_events}
    WHERE transactionState IN (${transactionStates
      .map((s) => `'${s}'`)
      .join(',')})
        AND toUInt64OrNull(JSON_VALUE(data, '$.createdAt')) IS NOT NULL
        ${dateConditions.length ? `AND ${dateConditions.join(' AND ')}` : ''}
    GROUP BY transactionId
    ),
    decision_events AS (
    SELECT
        transactionId,
        createdBy AS decided_by,
        MAX(createdAt) AS decided_at
    FROM ${transaction_events}
    WHERE status IN ('ALLOW', 'BLOCK')
        AND toUInt64OrNull(JSON_VALUE(data, '$.createdAt')) IS NOT NULL
        ${dateConditions.length ? `AND ${dateConditions.join(' AND ')}` : ''}
    GROUP BY transactionId, createdBy
    ),
    decision_counts AS (
    SELECT
        createdBy AS user,
        countIf(status = 'ALLOW') AS approvals,
        countIf(status = 'BLOCK') AS blocks
    FROM ${transaction_events}
    WHERE status IN ('ALLOW', 'BLOCK')
        ${dateConditions.length ? `AND ${dateConditions.join(' AND ')}` : ''}
    GROUP BY createdBy
    ),
    paired_events AS (
    SELECT
        d.transactionId,
        d.decided_by,
        c.created_at,
        d.decided_at,
        d.decided_at - c.created_at AS duration
    FROM decision_events d
    JOIN created_events c ON d.transactionId = c.transactionId
    )
    SELECT
    p.decided_by as accountId,
    AVG(p.duration) AS averageDecisionTime,
    d.approvals as approved,
    d.blocks as blocked
    FROM paired_events p
    LEFT JOIN decision_counts d ON p.decided_by = d.user
    WHERE accountId != ''
    GROUP BY p.decided_by, d.approvals, d.blocks
    ORDER BY averageDecisionTime
    `
    const result = await executeClickhouseQuery<
      DashboardStatsPaymentApprovals[]
    >(clickhouseClient, query)
    return result
  }
}
