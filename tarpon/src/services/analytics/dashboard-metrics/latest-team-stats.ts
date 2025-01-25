import { difference } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { updateRoles, withUpdatedAt } from './utils'
import { getMongoDbClient, getMongoDbClientDb } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { DashboardLatestTeamStatsItem } from '@/@types/openapi-internal/DashboardLatestTeamStatsItem'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'
import { DashboardLatestTeamStatsItemResponse } from '@/@types/openapi-internal/DashboardLatestTeamStatsItemResponse'
import { shouldUseReviewAssignments } from '@/utils/helpers'
import {
  getClickhouseClient,
  isClickhouseEnabled,
} from '@/utils/clickhouse/utils'
import { getLatestTeamStatsClickhouseQuery } from '@/utils/clickhouse/queries/latest-team-stats-clickhouse'

@traceable
export class LatestTeamStatsDashboardMetric {
  private static getStatusAccordingToAssignment(
    key: 'assignments' | 'reviewAssignments'
  ): CaseStatus[] {
    const reviewAssignmentsStatus = CASE_STATUSS.filter((status) =>
      shouldUseReviewAssignments(status)
    )
    const assignmentsStatus = difference(CASE_STATUSS, reviewAssignmentsStatus)
    return key === 'reviewAssignments'
      ? reviewAssignmentsStatus
      : assignmentsStatus
  }
  public static async refresh(
    tenantId: string,
    dynamoDb: DynamoDBDocumentClient
  ): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const alertAggregationCollection =
      DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(tenantId)
    const caseAggregationCollection =
      DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(tenantId)

    const lastUpdatedAt = Date.now()

    // Cases
    {
      await db
        .collection(caseAggregationCollection)
        .createIndex({ accountId: 1 }, { unique: true })

      await db.collection(caseAggregationCollection).createIndex({
        updatedAt: 1,
      })

      {
        const assignmentsPipeline = [
          {
            $match: {
              caseStatus: {
                $in: this.getStatusAccordingToAssignment('assignments').filter(
                  (status) => status !== 'CLOSED'
                ),
              },
            },
          },
          {
            $unwind: '$assignments',
          },
          {
            $match: {
              'assignments.assigneeUserId': {
                $exists: true,
                $ne: null,
              },
            },
          },
          {
            $group: {
              _id: {
                accountId: '$assignments.assigneeUserId',
              },
              open: {
                $sum: {
                  $cond: [{ $in: ['$caseStatus', ['OPEN', 'REOPENED']] }, 1, 0],
                },
              },
              inProgress: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$caseStatus', 'OPEN_IN_PROGRESS'],
                    },
                    1,
                    0,
                  ],
                },
              },
              onHold: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$caseStatus', 'OPEN_ON_HOLD'],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: false,
              accountId: '$_id.accountId',
              inProgress: 1,
              onHold: 1,
              open: 1,
            },
          },
          {
            $merge: {
              into: caseAggregationCollection,
              on: ['accountId'],
              whenMatched: 'merge',
            },
          },
        ]

        const reviewAssignmentspipeline = [
          {
            $match: {
              caseStatus: {
                $in: this.getStatusAccordingToAssignment('reviewAssignments'),
              },
            },
          },
          {
            $unwind: '$reviewAssignments',
          },
          {
            $match: {
              'reviewAssignments.assigneeUserId': {
                $exists: true,
                $ne: null,
              },
            },
          },
          {
            $group: {
              _id: {
                accountId: '$reviewAssignments.assigneeUserId',
              },
              escalated: {
                $sum: {
                  $cond: [{ $eq: ['$caseStatus', 'ESCALATED'] }, 1, 0],
                },
              },
              reviewInProgress: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$caseStatus', 'ESCALATED_IN_PROGRESS'],
                    },
                    1,
                    0,
                  ],
                },
              },
              reviewOnHold: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$caseStatus', 'ESCALATED_ON_HOLD'],
                    },
                    1,
                    0,
                  ],
                },
              },
              inReview: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$caseStatus',
                        [
                          'IN_REVIEW_OPEN',
                          'IN_REVIEW_CLOSED',
                          'IN_REVIEW_REOPENED',
                          'IN_REVIEW_ESCALATED',
                        ],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: false,
              accountId: '$_id.accountId',
              reviewInProgress: 1,
              escalated: 1,
              reviewOnHold: 1,
              inReview: 1,
            },
          },
          {
            $merge: {
              into: caseAggregationCollection,
              on: ['accountId'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection
          .aggregate(withUpdatedAt(assignmentsPipeline, lastUpdatedAt))
          .next()
        await casesCollection
          .aggregate(withUpdatedAt(reviewAssignmentspipeline, lastUpdatedAt))
          .next()
      }
    }

    // Alerts
    {
      await db
        .collection(alertAggregationCollection)
        .createIndex({ accountId: 1 }, { unique: true })

      await db.collection(alertAggregationCollection).createIndex({
        updatedAt: 1,
      })

      {
        const assignmentsPipeline = [
          {
            $match: {
              'alerts.alertStatus': {
                $in: this.getStatusAccordingToAssignment('assignments').filter(
                  (status) => status !== 'CLOSED'
                ),
              },
            },
          },
          {
            $unwind: '$alerts',
          },
          {
            $unwind: '$alerts.assignments',
          },
          {
            $match: {
              'alerts.assignments.assigneeUserId': {
                $exists: true,
                $ne: null,
              },
              'alerts.alertStatus': {
                $in: this.getStatusAccordingToAssignment('assignments').filter(
                  (status) => status !== 'CLOSED'
                ),
              },
            },
          },
          {
            $group: {
              _id: {
                accountId: '$alerts.assignments.assigneeUserId',
              },
              open: {
                $sum: {
                  $cond: [
                    { $in: ['$alerts.alertStatus', ['OPEN', 'REOPENED']] },
                    1,
                    0,
                  ],
                },
              },
              inProgress: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$alerts.alertStatus', 'OPEN_IN_PROGRESS'],
                    },
                    1,
                    0,
                  ],
                },
              },
              onHold: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$alerts.alertStatus', 'OPEN_ON_HOLD'],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: false,
              accountId: '$_id.accountId',
              inProgress: 1,
              onHold: 1,
              open: 1,
            },
          },
          {
            $merge: {
              into: alertAggregationCollection,
              on: ['accountId'],
              whenMatched: 'merge',
            },
          },
        ]

        const reviewAssignmentspipeline = [
          {
            $match: {
              'alerts.reviewAssignments': {
                $exists: true,
                $ne: null,
              },
              'alerts.alertStatus': {
                $in: this.getStatusAccordingToAssignment('reviewAssignments'),
              },
            },
          },
          {
            $unwind: '$alerts',
          },
          {
            $unwind: '$alerts.reviewAssignments',
          },
          {
            $match: {
              'alerts.reviewAssignments.assigneeUserId': {
                $exists: true,
                $ne: null,
              },
            },
          },
          {
            $group: {
              _id: {
                accountId: '$alerts.reviewAssignments.assigneeUserId',
              },
              escalated: {
                $sum: {
                  $cond: [{ $eq: ['$alerts.alertStatus', 'ESCALATED'] }, 1, 0],
                },
              },
              reviewInProgress: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$alerts.alertStatus', 'ESCALATED_IN_PROGRESS'],
                    },
                    1,
                    0,
                  ],
                },
              },
              reviewOnHold: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$alerts.alertStatus', 'ESCALATED_ON_HOLD'],
                    },
                    1,
                    0,
                  ],
                },
              },
              inReview: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$alerts.alertStatus',
                        [
                          'IN_REVIEW_OPEN',
                          'IN_REVIEW_CLOSED',
                          'IN_REVIEW_REOPENED',
                          'IN_REVIEW_ESCALATED',
                        ],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $project: {
              _id: false,
              accountId: '$_id.accountId',
              reviewInProgress: 1,
              escalated: 1,
              reviewOnHold: 1,
              inReview: 1,
            },
          },
          {
            $merge: {
              into: alertAggregationCollection,
              on: ['accountId'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection
          .aggregate(withUpdatedAt(assignmentsPipeline, lastUpdatedAt))
          .next()
        await casesCollection
          .aggregate(withUpdatedAt(reviewAssignmentspipeline, lastUpdatedAt))
          .next()
      }
    }
    const connections = { mongoDb, dynamoDb }
    await updateRoles(alertAggregationCollection, connections)
    await updateRoles(caseAggregationCollection, connections)
  }

  public static async get(
    tenantId: string,
    scope: 'CASES' | 'ALERTS',
    accountIds?: Array<string>,
    pageSize?: number,
    page?: number
  ): Promise<DashboardLatestTeamStatsItemResponse> {
    if (isClickhouseEnabled()) {
      return this.getClickhouse(tenantId, scope, accountIds, pageSize, page)
    }
    const db = await getMongoDbClientDb()
    const collectionName =
      scope === 'ALERTS'
        ? DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(tenantId)
        : DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(tenantId)
    const collection =
      db.collection<DashboardLatestTeamStatsItem>(collectionName)

    const matchConditions: Record<string, unknown>[] = []

    if (accountIds != null && accountIds.length > 0) {
      matchConditions.push({ accountId: { $in: accountIds } })
    }

    const basePipeline = [
      ...(matchConditions.length > 0
        ? [{ $match: { $and: matchConditions } }]
        : []),
      {
        $project: {
          _id: false,
          accountId: true,
          open: { $ifNull: ['$open', 0] },
          inReview: { $ifNull: ['$inReview', 0] },
          inProgress: {
            $add: [
              { $ifNull: ['$reviewInProgress', 0] },
              { $ifNull: ['$inProgress', 0] },
            ],
          },
          escalated: { $ifNull: ['$escalated', 0] },
          onHold: {
            $add: [
              { $ifNull: ['$reviewOnHold', 0] },
              { $ifNull: ['$onHold', 0] },
            ],
          },
        },
      },
    ]

    const pipeline = [
      {
        $facet: {
          paginatedData: [
            ...basePipeline,
            { $sort: { accountId: 1 } },
            ...(pageSize && page
              ? [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }]
              : []),
          ],
          totalCount: [...basePipeline, { $count: 'count' }],
        },
      },
    ]

    const [result] = await collection
      .aggregate<{
        paginatedData: {
          role: string
          accountId: string
          open: number
          inReview: number
          inProgress: number
          escalated: number
          onHold: number
        }[]
        totalCount: { count: number }[]
      }>(pipeline, { allowDiskUse: true })
      .toArray()

    return {
      items: result?.paginatedData ?? [],
      total: result?.totalCount[0]?.count ?? 0,
    }
  }

  public static async getClickhouse(
    tenantId: string,
    scope: 'CASES' | 'ALERTS',
    accountIds?: Array<string>,
    pageSize?: number,
    page?: number
  ): Promise<DashboardLatestTeamStatsItemResponse> {
    const client = await getClickhouseClient(tenantId)
    const assignmentStatuses = this.getStatusAccordingToAssignment(
      'assignments'
    ).filter((status) => status !== 'CLOSED')
    const reviewAssignmentStatuses =
      this.getStatusAccordingToAssignment('reviewAssignments')

    const viewQuery = getLatestTeamStatsClickhouseQuery(
      scope,
      assignmentStatuses,
      reviewAssignmentStatuses,
      accountIds
    )
    const query = `
    WITH view as (${viewQuery})
    SELECT 
      accountId,
      open,
      inReview,
      (COALESCE(reviewInProgress, 0) + COALESCE(inProgress, 0)) as inProgress,
      escalated,
      (COALESCE(reviewOnHold, 0) + COALESCE(onHold, 0)) as onHold,
      (SELECT count(DISTINCT accountId) FROM view) AS total_count
    FROM view
    ORDER BY accountId
    ${
      pageSize && page
        ? `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
        : ''
    }
    `

    const queryResult = await client.query({ query, format: 'JSONEachRow' })
    const result = await queryResult.json<{
      accountId: string
      open: number
      inReview: number
      inProgress: number
      escalated: number
      onHold: number
      total_count: number
    }>()

    const total = Number(result[0]?.total_count ?? 0)
    return {
      items: result.map((row) => ({
        accountId: row.accountId,
        open: Number(row.open),
        inReview: Number(row.inReview),
        inProgress: Number(row.inProgress),
        escalated: Number(row.escalated),
        onHold: Number(row.onHold),
      })),
      total,
    }
  }
}
