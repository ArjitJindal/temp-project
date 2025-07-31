import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { getAffectedInterval } from '../../dashboard/utils'
import { TimeRange } from '../../dashboard/repositories/types'
import { cleanUpStaleData, updateRoles, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import {
  getMongoDbClient,
  getMongoDbClientDb,
  paginatePipeline,
} from '@/utils/mongodb-utils'
import { HOUR_DATE_FORMAT, HOUR_DATE_FORMAT_JS } from '@/core/constants'
import {
  CASES_COLLECTION,
  DASHBOARD_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_TEAM_CASES_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { DashboardTeamStatsItem } from '@/@types/openapi-internal/DashboardTeamStatsItem'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { DashboardTeamStatsItemResponse } from '@/@types/openapi-internal/DashboardTeamStatsItemResponse'
import { traceable } from '@/core/xray'
import {
  getClickhouseClient,
  isClickhouseEnabled,
  executeClickhouseQuery,
} from '@/utils/clickhouse/utils'
import { getMaterialisedViewQuery } from '@/utils/clickhouse/materialised-views-queries'

interface TimestampCondition {
  $gte?: number
  $lte?: number
}

@traceable
export class TeamStatsDashboardMetric {
  public static async refresh(
    tenantId: string,
    dynamoDb: DynamoDBDocumentClient,
    timeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const alertAggregationCollection =
      DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenantId)
    const caseAggregationCollection =
      DASHBOARD_TEAM_CASES_STATS_HOURLY(tenantId)

    const lastUpdatedAt = Date.now()
    let timestampCondition: TimestampCondition | null = null
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampCondition = {
        $gte: start,
        $lte: end,
      }
    }

    const commonInvestigationTimePipeline = (
      timestampCondition: TimestampCondition | null
    ) => {
      return [
        {
          $project: {
            assignments: 1,
            reviewAssignments: 1,
            transitions: {
              $zip: {
                inputs: ['$statusChanges', '$nextStatusChanges'],
                useLongestLength: true,
              },
            },
            caseId: 1,
            caseStatus: 1,
          },
        },
        {
          $unwind: '$transitions',
        },
        {
          $addFields: {
            start: { $arrayElemAt: ['$transitions', 0] },
            end: { $arrayElemAt: ['$transitions', 1] },
          },
        },
        {
          $match: {
            'start.caseStatus': {
              $in: ['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS'],
            },
            'end.timestamp': {
              $gte: timestampCondition ? timestampCondition.$gte : 0,
              $lte: timestampCondition
                ? timestampCondition.$lte
                : Number.MAX_SAFE_INTEGER,
            },
          },
        },
        {
          $project: {
            assignments: {
              $cond: {
                if: { $eq: ['$start.caseStatus', 'ESCALATED_IN_PROGRESS'] },
                then: '$reviewAssignments',
                else: '$assignments',
              },
            },
            start: 1,
            end: 1,
            caseId: 1,
            caseStatus: 1,
          },
        },
        {
          $match: {
            'assignments.0': { $exists: true },
          },
        },
        {
          $unwind: '$assignments',
        },
        {
          $project: {
            user: '$assignments.assigneeUserId',
            investigationTime: {
              $subtract: ['$end.timestamp', '$start.timestamp'],
            },
            timestamp: '$end.timestamp',
            caseId: 1,
            caseStatus: 1,
          },
        },
        {
          $group: {
            _id: {
              assigneeUserId: '$user',
              caseStatus: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $in: [
                          '$caseStatus',
                          ['OPEN_IN_PROGRESS', 'OPEN_ON_HOLD'],
                        ],
                      },
                      then: 'OPEN',
                    },
                    {
                      case: {
                        $in: [
                          '$caseStatus',
                          ['ESCALATED_IN_PROGRESS', 'ESCALATED_ON_HOLD'],
                        ],
                      },
                      then: 'ESCALATED',
                    },
                  ],
                  default: '$caseStatus',
                },
              },
              date: {
                $dateToString: {
                  format: HOUR_DATE_FORMAT,
                  date: { $toDate: { $toLong: '$timestamp' } },
                },
              },
            },
            investigationTime: { $sum: '$investigationTime' },
            caseIds: { $addToSet: '$caseId' },
          },
        },
        {
          $project: {
            accountId: '$_id.assigneeUserId',
            date: '$_id.date',
            investigationTime: 1,
            status: '$_id.caseStatus',
            caseIds: 1,
            _id: false,
          },
        },
      ]
    }

    // Cases
    {
      await db
        .collection(caseAggregationCollection)
        .createIndex({ date: -1, accountId: 1, status: 1 }, { unique: true })

      {
        const pipeline = [
          {
            $match: {
              ...(timestampCondition
                ? { 'statusChanges.timestamp': timestampCondition }
                : {}),
              'statusChanges.userId': { $ne: null, $exists: true },
              'statusChanges.caseStatus': {
                $in: [
                  'CLOSED',
                  'ESCALATED',
                  'OPEN_IN_PROGRESS',
                  'ESCALATED_IN_PROGRESS',
                ],
              },
            },
          },
          {
            $unwind: '$statusChanges',
          },
          {
            $match: {
              'statusChanges.userId': { $ne: null, $exists: true },
              'statusChanges.caseStatus': {
                $in: [
                  'CLOSED',
                  'ESCALATED',
                  'OPEN_IN_PROGRESS',
                  'ESCALATED_IN_PROGRESS',
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                accountId: '$statusChanges.userId',
                status: '$caseStatus',
                date: {
                  $dateToString: {
                    format: HOUR_DATE_FORMAT,
                    date: {
                      $toDate: {
                        $toLong: '$statusChanges.timestamp',
                      },
                    },
                  },
                },
              },
              closedBy: {
                $sum: {
                  $cond: [
                    { $eq: ['$statusChanges.caseStatus', 'CLOSED'] },
                    1,
                    0,
                  ],
                },
              },
              escalatedBy: {
                $sum: {
                  $cond: [
                    { $eq: ['$statusChanges.caseStatus', 'ESCALATED'] },
                    1,
                    0,
                  ],
                },
              },
              inProgress: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$statusChanges.caseStatus',
                        ['OPEN_IN_PROGRESS', 'ESCALATED_IN_PROGRESS'],
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
              status: '$_id.status',
              accountId: '$_id.accountId',
              date: '$_id.date',
              closedBy: 1,
              escalatedBy: 1,
              inProgress: 1,
            },
          },
          {
            $merge: {
              into: caseAggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection
          .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
          .next()
      }

      // Assigned to
      {
        const pipeline = [
          {
            $match: {
              ...(timestampCondition != null && {
                'assignments.timestamp': timestampCondition,
              }),
            },
          },
          {
            $unwind: {
              path: '$assignments',
            },
          },
          {
            $match: {
              'assignments.assigneeUserId': { $ne: null, $exists: true },
            },
          },
          {
            $group: {
              _id: {
                status: '$caseStatus',
                accountId: '$assignments.assigneeUserId',
                date: {
                  $dateToString: {
                    format: HOUR_DATE_FORMAT,
                    date: {
                      $toDate: {
                        $toLong: '$assignments.timestamp',
                      },
                    },
                  },
                },
              },
              assignedTo: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: false,
              status: '$_id.status',
              accountId: '$_id.accountId',
              date: '$_id.date',
              assignedTo: true,
              inProgress: true,
            },
          },
          {
            $merge: {
              into: caseAggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]
        await casesCollection
          .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
          .next()
      }
      // Number of Cases Closed by system of result all the alerts are closed by same person
      {
        const toMatchPipeline = {
          $match: {
            ...(timestampCondition != null && {
              'statusChanges.timestamp': timestampCondition,
              'alerts.statusChanges.timestamp': timestampCondition,
            }),
            'statusChanges.caseStatus': 'CLOSED',
            'statusChanges.userId': FLAGRIGHT_SYSTEM_USER,
            'alerts.statusChanges.caseStatus': 'CLOSED',
          },
        }

        const pipeline = [
          toMatchPipeline,
          {
            $unwind: '$statusChanges',
          },
          toMatchPipeline,
          {
            $unwind: '$alerts',
          },
          {
            $addFields: {
              'alerts.updatedStatusChanges': {
                $filter: {
                  input: '$alerts.statusChanges',
                  cond: {
                    $and: [
                      {
                        $gte: [
                          '$$this.timestamp',
                          timestampCondition?.$gte || 0,
                        ],
                      },
                      {
                        $lte: [
                          '$$this.timestamp',
                          timestampCondition?.$lte || Number.MAX_SAFE_INTEGER,
                        ],
                      },
                      {
                        $eq: ['$$this.caseStatus', 'CLOSED'],
                      },
                    ],
                  },
                },
              },
            },
          },
          {
            $addFields: {
              'alerts.updatedStatusChanges': {
                $cond: {
                  if: { $eq: ['$alerts.updatedStatusChanges', null] },
                  then: [],
                  else: '$alerts.updatedStatusChanges',
                },
              },
            },
          },
          {
            $addFields: {
              'alerts.lastStatusChange': {
                $cond: {
                  if: { $eq: ['$alerts.updatedStatusChanges', []] },
                  then: {
                    userId: null,
                  },
                  else: {
                    $arrayElemAt: ['$alerts.updatedStatusChanges', -1],
                  },
                },
              },
            },
          },
          {
            $group: {
              _id: '$caseId',
              alerts: {
                $push: {
                  _id: '$alerts._id',
                  lastStatusChange: '$alerts.lastStatusChange',
                  alertId: '$alerts.alertId',
                },
              },
              userIds: {
                $addToSet: '$alerts.lastStatusChange.userId',
              },
              status: {
                $first: '$caseStatus',
              },
              statusChanges: {
                $addToSet: '$statusChanges',
              },
            },
          },
          {
            $unwind: '$statusChanges',
          },
          {
            $match: {
              userIds: {
                $size: 1,
                $elemMatch: {
                  $ne: null,
                },
              },
            },
          },
          {
            $addFields: {
              accountId: {
                $arrayElemAt: ['$userIds', 0],
              },
            },
          },
          {
            $group: {
              _id: {
                accountId: '$accountId',
                status: '$status',
                date: {
                  $dateToString: {
                    format: HOUR_DATE_FORMAT,
                    date: {
                      $toDate: {
                        $toLong: '$statusChanges.timestamp',
                      },
                    },
                  },
                },
              },
              count: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: 0,
              accountId: '$_id.accountId',
              status: '$_id.status',
              date: '$_id.date',
              closedBySystem: '$count',
            },
          },
          {
            $merge: {
              into: caseAggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection
          .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
          .next()
      }

      // Investigation time
      {
        const matchPipeline = {
          $match: {
            ...(timestampCondition != null
              ? { 'statusChanges.timestamp': timestampCondition }
              : {}),
            'statusChanges.1': { $exists: true },
          },
        }

        const pipeline = [
          matchPipeline,
          {
            $project: {
              assignments: 1,
              reviewAssignments: 1,
              statusChanges: 1,
              caseStatus: 1,
              nextStatusChanges: {
                $slice: ['$statusChanges', 1, { $size: '$statusChanges' }],
              },
              caseId: '$caseId',
            },
          },
          ...commonInvestigationTimePipeline(timestampCondition),
          {
            $merge: {
              into: caseAggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection
          .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
          .next()
      }
    }

    // Alerts
    {
      await db
        .collection(alertAggregationCollection)
        .createIndex({ date: -1, accountId: 1, status: 1 }, { unique: true })

      {
        const matchPipeline = {
          $match: {
            ...(timestampCondition != null
              ? { 'alerts.statusChanges.timestamp': timestampCondition }
              : {}),
            'alerts.statusChanges.userId': { $ne: null, $exists: true },
            'alerts.statusChanges.caseStatus': {
              $in: [
                'CLOSED',
                'ESCALATED',
                'ESCALATED_IN_PROGRESS',
                'OPEN_IN_PROGRESS',
              ],
            },
          },
        }

        const pipeline = [
          matchPipeline,
          {
            $unwind: '$alerts',
          },
          {
            $unwind: '$alerts.statusChanges',
          },
          matchPipeline,
          {
            $group: {
              _id: {
                accountId: '$alerts.statusChanges.userId',
                status: '$alerts.alertStatus',
                date: {
                  $dateToString: {
                    format: HOUR_DATE_FORMAT,
                    date: {
                      $toDate: {
                        $toLong: '$alerts.statusChanges.timestamp',
                      },
                    },
                  },
                },
              },
              closedBy: {
                $sum: {
                  $cond: [
                    { $eq: ['$alerts.statusChanges.caseStatus', 'CLOSED'] },
                    1,
                    0,
                  ],
                },
              },
              escalatedBy: {
                $sum: {
                  $cond: [
                    { $eq: ['$alerts.statusChanges.caseStatus', 'ESCALATED'] },
                    1,
                    0,
                  ],
                },
              },
              inProgress: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$alerts.statusChanges.caseStatus',
                        ['ESCALATED_IN_PROGRESS', 'OPEN_IN_PROGRESS'],
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
              status: '$_id.status',
              date: '$_id.date',
              closedBy: true,
              escalatedBy: true,
              inProgress: true,
            },
          },
          {
            $merge: {
              into: alertAggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection
          .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
          .next()
      }

      // Assigned to
      {
        const pipeline = [
          {
            $match: {
              ...(timestampCondition != null && {
                'alerts.assignments.timestamp': timestampCondition,
              }),
            },
          },
          {
            $unwind: '$alerts',
          },
          {
            $match: {
              'alerts.assignments.assigneeUserId': { $ne: null, $exists: true },
            },
          },
          {
            $unwind: {
              path: '$alerts.assignments',
            },
          },
          {
            $group: {
              _id: {
                status: '$alerts.alertStatus',
                accountId: '$alerts.assignments.assigneeUserId',
                date: {
                  $dateToString: {
                    format: HOUR_DATE_FORMAT,
                    date: {
                      $toDate: {
                        $toLong: '$alerts.assignments.timestamp',
                      },
                    },
                  },
                },
              },
              assignedTo: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: false,
              status: '$_id.status',
              accountId: '$_id.accountId',
              date: '$_id.date',
              assignedTo: true,
            },
          },
          {
            $merge: {
              into: alertAggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]
        await casesCollection
          .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
          .next()
      }

      // Alerts Closed By System
      {
        const pipeline = [
          {
            $match: {
              ...(timestampCondition != null
                ? {
                    'alerts.statusChanges.timestamp': timestampCondition,
                    'statusChanges.timestamp': timestampCondition,
                  }
                : {}),
              'alerts.statusChanges.caseStatus': 'CLOSED',
              'alerts.statusChanges.userId': FLAGRIGHT_SYSTEM_USER,
              'statusChanges.caseStatus': 'CLOSED',
            },
          },
          {
            $unwind: '$statusChanges',
          },
          {
            $match: {
              'statusChanges.caseStatus': 'CLOSED',
              ...(timestampCondition != null
                ? {
                    'statusChanges.timestamp': timestampCondition,
                  }
                : {}),
            },
          },
          {
            $unwind: '$alerts',
          },
          {
            $unwind: '$alerts.statusChanges',
          },
          {
            $match: {
              ...(timestampCondition != null
                ? { 'alerts.statusChanges.timestamp': timestampCondition }
                : {}),
              'alerts.statusChanges.caseStatus': 'CLOSED',
              'alerts.statusChanges.userId': FLAGRIGHT_SYSTEM_USER,
            },
          },
          {
            $group: {
              _id: {
                accountId: '$statusChanges.userId',
                caseStatus: '$alerts.statusChanges.caseStatus',
                timestamp: {
                  $dateToString: {
                    format: HOUR_DATE_FORMAT,
                    date: {
                      $toDate: {
                        $toLong: '$statusChanges.timestamp',
                      },
                    },
                  },
                },
              },
              count: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: 0,
              accountId: '$_id.accountId',
              status: '$_id.caseStatus',
              date: '$_id.timestamp',
              closedBySystem: '$count',
            },
          },
          {
            $merge: {
              into: alertAggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection
          .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
          .next()
      }

      // Investigation Time
      {
        const matchPipeline = {
          $match: {
            ...(timestampCondition != null
              ? { 'alerts.statusChanges.timestamp': timestampCondition }
              : {}),
            'alerts.statusChanges.1': { $exists: true },
          },
        }

        const pipeline = [
          matchPipeline,
          {
            $unwind: '$alerts',
          },
          matchPipeline,
          {
            $project: {
              assignments: '$alerts.assignments',
              reviewAssignments: '$alerts.reviewAssignments',
              statusChanges: '$alerts.statusChanges',
              caseStatus: '$alerts.alertStatus',
              nextStatusChanges: {
                $slice: [
                  '$alerts.statusChanges',
                  1,
                  { $size: '$alerts.statusChanges' },
                ],
              },
              caseId: '$alerts.alertId',
            },
          },
          ...commonInvestigationTimePipeline(timestampCondition),
          {
            $merge: {
              into: alertAggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection
          .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
          .next()
      }
    }

    await Promise.all([
      cleanUpStaleData(
        caseAggregationCollection,
        'date',
        lastUpdatedAt,
        timeRange,
        'HOUR'
      ),
      cleanUpStaleData(
        alertAggregationCollection,
        'date',
        lastUpdatedAt,
        timeRange,
        'HOUR'
      ),
    ])

    const connections = {
      mongoDb: await getMongoDbClient(),
      dynamoDb,
    }

    await updateRoles(alertAggregationCollection, connections)
    await updateRoles(caseAggregationCollection, connections)
  }

  public static async get(
    tenantId: string,
    scope: 'CASES' | 'ALERTS',
    startTimestamp: number,
    endTimestamp: number,
    status: (CaseStatus | AlertStatus)[],
    accounts: { id: string; role: string }[],
    pageSize: number,
    page: number
  ): Promise<DashboardTeamStatsItemResponse> {
    const accountIds = accounts.map((account) => account.id) ?? []
    if (isClickhouseEnabled()) {
      return this.getClickhouse(
        tenantId,
        scope,
        startTimestamp,
        endTimestamp,
        status,
        accounts,
        pageSize,
        page
      )
    }
    const db = await getMongoDbClientDb()
    const collectionName =
      scope === 'ALERTS'
        ? DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenantId)
        : DASHBOARD_TEAM_CASES_STATS_HOURLY(tenantId)

    const collection = db.collection<DashboardTeamStatsItem>(collectionName)

    let dateCondition: Record<string, unknown> | null = null
    if (startTimestamp != null || endTimestamp != null) {
      dateCondition = {}
      if (startTimestamp != null) {
        dateCondition['$gte'] =
          dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
      }
      if (endTimestamp != null) {
        dateCondition['$lte'] = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)
      }
    }

    const matchConditions: Record<string, unknown>[] = []
    if (dateCondition != null) {
      matchConditions.push({ date: dateCondition })
    }
    if (status != null && status.length > 0) {
      matchConditions.push({ status: { $in: status } })
    }
    if (accountIds != null && accountIds.length > 0) {
      matchConditions.push({ accountId: { $in: accountIds } })
    }

    const basePipeline = [
      { $sort: { date: -1 } },
      ...(matchConditions.length > 0
        ? [{ $match: { $and: matchConditions } }]
        : []),
      {
        $group: {
          _id: '$accountId',
          closedBy: {
            $sum: '$closedBy',
          },
          assignedTo: {
            $sum: '$assignedTo',
          },
          investigationTime: {
            $sum: '$investigationTime',
          },
          caseIds: {
            $push: '$caseIds',
          },
          closedBySystem: {
            $sum: '$closedBySystem',
          },
          inProgress: {
            $sum: '$inProgress',
          },
          escalatedBy: {
            $sum: '$escalatedBy',
          },
        },
      },
      {
        $addFields: {
          caseIds: {
            $reduce: {
              input: '$caseIds',
              initialValue: [],
              in: { $setUnion: ['$$value', '$$this'] },
            },
          },
        },
      },
      {
        $project: {
          _id: false,
          accountId: '$_id',
          role: true,
          closedBy: true,
          assignedTo: true,
          caseIds: true,
          investigationTime: true,
          closedBySystem: true,
          inProgress: true,
          escalatedBy: true,
        },
      },
    ]

    const countPipeline = [...basePipeline, { $count: 'total' }]
    const countResult = await collection
      .aggregate(countPipeline, { allowDiskUse: true })
      .toArray()
    const total = countResult[0]?.total ?? 0

    const paginationPipeline = paginatePipeline({
      page: page,
      pageSize: pageSize,
    })

    const paginatedPipeline = [...basePipeline, ...paginationPipeline]
    const data = await collection
      .aggregate<{
        accountId: string
        role: string
        closedBy: number
        assignedTo: number
        caseIds: string[]
        investigationTime: number
        closedBySystem: number
        inProgress: number
        escalatedBy: number
      }>(paginatedPipeline, { allowDiskUse: true })
      .toArray()

    return {
      items: data.map((item) => ({
        ...item,
        role: accounts.find((account) => account.id === item.accountId)?.role,
      })),
      total,
    }
  }

  public static async getClickhouse(
    tenantId: string,
    scope: 'CASES' | 'ALERTS',
    startTimestamp: number,
    endTimestamp: number,
    status: (CaseStatus | AlertStatus)[],
    accounts: { id: string; role: string }[],
    pageSize: number,
    page: number
  ): Promise<DashboardTeamStatsItemResponse> {
    const accountIds = accounts.map((account) => account.id)
    const clickhouseClient = await getClickhouseClient(tenantId)
    const viewQuery =
      scope === 'CASES'
        ? getMaterialisedViewQuery('CASES', startTimestamp, endTimestamp)
        : getMaterialisedViewQuery('ALERTS', startTimestamp, endTimestamp)

    const dateConditions: string[] = []
    if (startTimestamp) {
      dateConditions.push(
        `date >= '${dayjs(startTimestamp).format('YYYY-MM-DD HH:00:00')}'`
      )
    }
    if (endTimestamp) {
      dateConditions.push(
        `date <= '${dayjs(endTimestamp).format('YYYY-MM-DD HH:00:00')}'`
      )
    }

    const conditions = [
      ...(status?.length
        ? [`status IN (${status.map((s) => `'${s}'`).join(',')})`]
        : []),
      ...(accountIds?.length
        ? [`accountId IN (${accountIds.map((id) => `'${id}'`).join(',')})`]
        : []),
      ...dateConditions,
    ]

    const query = `
    WITH view AS (
      ${viewQuery}
    )
    SELECT
      accountId,
      sum(closedBy) as closedBy,
      sum(assignedTo) as assignedTo,
      sum(investigationTime) as investigationTime,
      groupArrayDistinct(caseIds) as caseIds,
      sum(closedBySystem) as closedBySystem,
      sum(inProgress) as inProgress,
      sum(escalatedBy) as escalatedBy
    FROM view
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    GROUP BY accountId
    ORDER BY accountId
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `
    const countQuery = `
    WITH view AS (
      ${viewQuery}
    )
    SELECT count(*) as count
      FROM (
        SELECT accountId
        FROM view
        ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        GROUP BY accountId
      )`

    const [items, count] = await Promise.all([
      executeClickhouseQuery<Array<DashboardTeamStatsItem>>(clickhouseClient, {
        query,
        format: 'JSONEachRow',
      }),

      executeClickhouseQuery<Array<{ count: number }>>(clickhouseClient, {
        query: countQuery,
        format: 'JSONEachRow',
      }),
    ])

    return {
      items: items.map((item) => ({
        ...item,
        closedBy: Number(item.closedBy),
        assignedTo: Number(item.assignedTo),
        investigationTime: Number(item.investigationTime),
        caseIds: [...new Set(item.caseIds?.flat() ?? [])],
        closedBySystem: Number(item.closedBySystem),
        inProgress: Number(item.inProgress),
        escalatedBy: Number(item.escalatedBy),
        role: accounts.find((account) => account.id === item.accountId)?.role,
      })),
      total: Number(count[0]?.count ?? 0),
    }
  }
}
