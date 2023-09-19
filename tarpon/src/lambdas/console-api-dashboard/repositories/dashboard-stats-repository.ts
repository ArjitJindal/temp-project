import { Db, MongoClient, WithId } from 'mongodb'
import { keyBy, round, sortBy } from 'lodash'
import { getAffectedInterval, getTimeLabels } from '../utils'
import { DashboardStatsDRSDistributionData } from './types'
import dayjs from '@/utils/dayjs'
import {
  DAY_DATE_FORMAT_JS,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  lookupPipelineStage,
  MONTH_DATE_FORMAT_JS,
} from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY,
  DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY,
  DASHBOARD_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_TEAM_CASES_STATS_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY,
  DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY,
  DRS_SCORES_DISTRIBUTION_STATS_COLLECTION,
  REPORT_COLLECTION,
  TRANSACTIONS_COLLECTION,
  TRANSACTION_TYPE_DISTRIBUTION_STATS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { DashboardTeamStatsItem } from '@/@types/openapi-internal/DashboardTeamStatsItem'
import { RULE_ACTIONS } from '@/@types/rule/rule-actions'
import { DashboardStatsRulesCountData } from '@/@types/openapi-internal/DashboardStatsRulesCountData'
import { DashboardStatsTransactionsCountData } from '@/@types/openapi-internal/DashboardStatsTransactionsCountData'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { logger } from '@/core/logger'
import { Case } from '@/@types/openapi-internal/Case'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { DashboardStatsHitsPerUserData } from '@/@types/openapi-internal/DashboardStatsHitsPerUserData'
import { FLAGRIGHT_SYSTEM_USER } from '@/services/rules-engine/repositories/alerts-repository'
import { DashboardStatsOverview } from '@/@types/openapi-internal/DashboardStatsOverview'
import { PAYMENT_METHODS } from '@/@types/openapi-internal-custom/PaymentMethod'
import { traceable } from '@/core/xray'
import { DashboardStatsClosingReasonDistributionStats } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStats'
import { DashboardStatsAlertPriorityDistributionStats } from '@/@types/openapi-internal/DashboardStatsAlertPriorityDistributionStats'
import { DashboardStatsClosingReasonDistributionStatsClosingReasonsData } from '@/@types/openapi-internal/DashboardStatsClosingReasonDistributionStatsClosingReasonsData'
import { hasFeature } from '@/core/utils/context'
import { Report } from '@/@types/openapi-internal/Report'
import { DashboardStatsTransactionTypeDistributionStats } from '@/@types/openapi-internal/DashboardStatsTransactionTypeDistributionStats'
import { DashboardStatsTransactionTypeDistributionStatsTransactionTypeData } from '@/@types/openapi-internal/DashboardStatsTransactionTypeDistributionStatsTransactionTypeData'
import { DashboardStatsDRSDistributionData as DRSDistributionStats } from '@/@types/openapi-internal/DashboardStatsDRSDistributionData'

export type TimeRange = {
  startTimestamp?: number
  endTimestamp?: number
}

interface TimestampCondition {
  $gte?: number
  $lte?: number
}

export type GranularityValuesType = 'HOUR' | 'MONTH' | 'DAY'
const granularityValues = { HOUR: 'HOUR', MONTH: 'MONTH', DAY: 'DAY' }

const TRANSACTION_STATE_KEY_TO_RULE_ACTION: Map<
  keyof DashboardStatsTransactionsCountData,
  RuleAction
> = new Map([
  ['flaggedTransactions', 'FLAG'],
  ['stoppedTransactions', 'BLOCK'],
  ['suspendedTransactions', 'SUSPEND'],
])

const CASE_GROUP_KEYS = {
  openCaseIds: {
    $addToSet: {
      $cond: {
        if: {
          $ne: ['$caseStatus', 'CLOSED'],
        },
        then: '$caseId',
        else: '$$REMOVE',
      },
    },
  },
  caseIds: {
    $addToSet: '$caseId',
  },
}

const CASE_PROJECT_KEYS = {
  openCasesCount: {
    $size: { $ifNull: ['$openCaseIds', []] },
  },
  casesCount: {
    $size: { $ifNull: ['$caseIds', []] },
  },
}

@traceable
export class DashboardStatsRepository {
  mongoDb: MongoClient
  tenantId: string

  constructor(
    tenantId: string,
    connections: {
      mongoDb: MongoClient
    }
  ) {
    this.mongoDb = connections.mongoDb as MongoClient
    this.tenantId = tenantId
  }

  public async recalculateHitsByUser(
    direction: 'ORIGIN' | 'DESTINATION',
    timeRange?: TimeRange
  ) {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const userFieldName =
      direction === 'ORIGIN'
        ? 'caseUsers.origin.userId'
        : 'caseUsers.destination.userId'
    const aggregationCollection =
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(this.tenantId)
    await db.collection(aggregationCollection).createIndex(
      {
        direction: 1,
        date: -1,
        userId: 1,
      },
      {
        unique: true,
      }
    )

    let timestampMatch = undefined
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        createdTimestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }
    const pipeline = [
      {
        $match: {
          ...timestampMatch,
          // NOTE: We only aggregate the stats for known users
          [userFieldName]: { $ne: null },
        },
      },
      {
        $unwind: {
          path: '$caseTransactions',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$createdTimestamp',
                  },
                },
              },
            },
            userId: `$${userFieldName}`,
          },
          rulesHit: {
            $sum: { $size: { $ifNull: ['$caseTransactions.hitRules', []] } },
          },
          transactionsHit: {
            $sum: 1,
          },
          ...CASE_GROUP_KEYS,
        },
      },
      {
        $project: {
          _id: false,
          date: '$_id.date',
          userId: '$_id.userId',
          direction,
          rulesHit: '$rulesHit',
          transactionsHit: '$transactionsHit',
          ...CASE_PROJECT_KEYS,
        },
      },
      {
        $merge: {
          into: aggregationCollection,
          on: ['direction', 'date', 'userId'],
          whenMatched: 'merge',
        },
      },
    ]
    await casesCollection.aggregate(pipeline).next()
  }

  public async recalculateRuleHitStats(timeRange?: TimeRange) {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const aggregationCollection = DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(
      this.tenantId
    )
    let timestampMatch = undefined
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        createdTimestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }
    const pipeline = [
      { $match: { ...timestampMatch } },
      {
        $unwind: {
          path: '$caseTransactions',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $addFields: {
          userHitRules: {
            $concatArrays: [
              {
                $ifNull: ['$caseUsers.origin.hitRules', []],
              },
              {
                $ifNull: ['$caseUsers.destination.hitRules', []],
              },
            ],
          },
        },
      },
      {
        $addFields: {
          allHitRules: {
            $concatArrays: ['$caseTransactions.hitRules', '$userHitRules'],
          },
        },
      },
      {
        $unwind: {
          path: '$allHitRules',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: {
            time: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: {
                  $toDate: {
                    $toLong: '$createdTimestamp',
                  },
                },
              },
            },
            ruleId: '$allHitRules.ruleId',
            ruleInstanceId: '$allHitRules.ruleInstanceId',
          },
          hitCount: {
            $sum: 1,
          },
          ...CASE_GROUP_KEYS,
        },
      },
      {
        $group: {
          _id: '$_id.time',
          rulesStats: {
            $push: {
              ruleId: '$_id.ruleId',
              ruleInstanceId: '$_id.ruleInstanceId',
              hitCount: '$hitCount',
              ...CASE_PROJECT_KEYS,
            },
          },
        },
      },
      {
        $merge: {
          into: aggregationCollection,
          whenMatched: 'merge',
        },
      },
    ]

    await casesCollection.aggregate(pipeline).next()
  }

  private async recalculateTeamStats(
    timeRange?: TimeRange,
    scope: Array<'CASES' | 'ALERTS'> = ['CASES', 'ALERTS']
  ) {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

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
    if (scope.includes('CASES')) {
      const aggregationCollection = DASHBOARD_TEAM_CASES_STATS_HOURLY(
        this.tenantId
      )

      await db
        .collection(aggregationCollection)
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
              into: aggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection.aggregate(pipeline).next()
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
              into: aggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]
        await casesCollection.aggregate(pipeline).next()
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
              into: aggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection.aggregate(pipeline).next()
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
              into: aggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection.aggregate(pipeline).next()
      }
    }

    // Alerts
    if (scope.includes('ALERTS')) {
      const aggregationCollection = DASHBOARD_TEAM_ALERTS_STATS_HOURLY(
        this.tenantId
      )

      await db
        .collection(aggregationCollection)
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
              into: aggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection.aggregate(pipeline).next()
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
              into: aggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]
        await casesCollection.aggregate(pipeline).next()
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
              into: aggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection.aggregate(pipeline).next()
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
              into: aggregationCollection,
              on: ['accountId', 'status', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        await casesCollection.aggregate(pipeline).next()
      }
    }
  }

  private sanitizeBucketBoundry(riskIntervalBoundries: Array<number>) {
    if (!riskIntervalBoundries) {
      return []
    }
    const legitIntervalBoundry = [riskIntervalBoundries[0]]
    for (let i = 1; i < riskIntervalBoundries.length; i++) {
      if (riskIntervalBoundries[i] === riskIntervalBoundries[i - 1]) {
        legitIntervalBoundry.push(riskIntervalBoundries[i] + 0.01)
      } else if (riskIntervalBoundries[i] < riskIntervalBoundries[i - 1]) {
        legitIntervalBoundry.push(riskIntervalBoundries[i - 1] + 0.01)
      } else {
        legitIntervalBoundry.push(riskIntervalBoundries[i])
      }
    }
    return legitIntervalBoundry
  }

  private async recalculateDRSDistributionStats(db: Db) {
    const usersCollection = db.collection<InternalUser>(
      USERS_COLLECTION(this.tenantId)
    )
    const dynamoDb = getDynamoDbClient()
    const aggregationCollection = DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(
      this.tenantId
    )
    const riskRepository = new RiskRepository(this.tenantId, { dynamoDb })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()

    const riskIntervalBoundries = riskClassificationValues.map(
      (classificationValue: RiskClassificationScore) =>
        classificationValue.lowerBoundRiskScore
    )
    riskIntervalBoundries.push(
      riskClassificationValues[riskClassificationValues.length - 1]
        .upperBoundRiskScore
    )
    // We need to sanitize the boundry - it must be strictly increasing. Limited info from mongo on the error code 40194
    // You can view the error log here: https://github.com/bwaldvogel/mongo-java-server/blob/main/test-common/src/main/java/de/bwaldvogel/mongo/backend/AbstractAggregationTest.java
    const sanitizedBounries = [
      ...new Set(this.sanitizeBucketBoundry(riskIntervalBoundries)), // duplicate values are not allowed in bucket boundaries
    ]

    await usersCollection
      .aggregate(
        [
          {
            $match: {
              'drsScore.drsScore': { $exists: true, $nin: [null, ''] },
            },
          },
          {
            $facet: {
              business: [
                {
                  $match: { type: 'BUSINESS' },
                },
                {
                  $bucket: {
                    groupBy: '$drsScore.drsScore',
                    boundaries: sanitizedBounries,
                    default: sanitizedBounries[sanitizedBounries.length - 1],
                    output: {
                      count: { $sum: 1 },
                    },
                  },
                },
              ],
              consumer: [
                {
                  $match: { type: 'CONSUMER' },
                },
                {
                  $bucket: {
                    groupBy: '$drsScore.drsScore',
                    boundaries: sanitizedBounries,
                    default: sanitizedBounries[sanitizedBounries.length - 1],
                    output: {
                      count: { $sum: 1 },
                    },
                  },
                },
              ],
            },
          },
          {
            $group: {
              _id: 'all',
              business: { $first: '$business' },
              consumer: { $first: '$consumer' },
            },
          },
          {
            $merge: {
              into: aggregationCollection,
              whenMatched: 'merge',
            },
          },
        ],
        { allowDiskUse: true }
      )
      .next()

    logger.info(`Aggregation done`)
  }

  public async recalculateTransactionsVolumeStats(
    db: Db,
    timeRange?: TimeRange
  ) {
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const aggregatedHourlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(this.tenantId)
    const aggregatedDailyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(this.tenantId)
    const aggregatedMonthlyCollectionName =
      DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(this.tenantId)

    const getHitRulesAggregationPipeline = (
      key: keyof DashboardStatsTransactionsCountData
    ) => {
      // Stages for calculating rules final action, which follows the same
      // logic as TransactionRepository.getAggregatedRuleStatus
      const rulesResultPipeline = [
        {
          $addFields: {
            hitRulesResult: {
              $map: {
                input: '$hitRules',
                as: 'rule',
                in: {
                  ruleAction: '$$rule.ruleAction',
                  order: {
                    $indexOfArray: [RULE_ACTIONS, '$$rule.ruleAction'],
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            hitRulesResult: {
              $reduce: {
                input: '$hitRulesResult',
                initialValue: null,
                in: {
                  $cond: {
                    if: {
                      $or: [
                        { $eq: ['$$value', null] },
                        { $lt: ['$$this.order', '$$value.order'] },
                      ],
                    },
                    then: '$$this',
                    else: '$$value',
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            hitRulesResult: {
              $cond: {
                if: { $eq: ['$hitRulesResult', null] },
                then: 'null',
                else: '$hitRulesResult.ruleAction',
              },
            },
          },
        },
      ]
      const ruleAction = TRANSACTION_STATE_KEY_TO_RULE_ACTION.get(key)
      const ruleActionMatch = ruleAction && { hitRulesResult: ruleAction }
      let timestampMatch = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, 'HOUR')
        timestampMatch = {
          timestamp: {
            $gte: start,
            $lt: end,
          },
        }
      }
      return [
        ...(ruleAction ? rulesResultPipeline : []),
        { $match: { ...timestampMatch, ...ruleActionMatch } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: HOUR_DATE_FORMAT,
                date: { $toDate: { $toLong: '$timestamp' } },
              },
            },
            [key]: { $sum: 1 },
          },
        },
        {
          $merge: {
            into: aggregatedHourlyCollectionName,
            whenMatched: 'merge',
          },
        },
      ]
    }

    const getPaymentMethodAggregationPipeline = () => {
      let timestampMatch = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, 'HOUR')
        timestampMatch = {
          timestamp: {
            $gte: start,
            $lt: end,
          },
        }
      }
      return [
        ...(timestampMatch ? [{ $match: timestampMatch }] : []),
        {
          $addFields: {
            paymentMethods: [
              '$originPaymentDetails.method',
              '$destinationPaymentDetails.method',
            ],
          },
        },
        {
          $unwind: {
            path: '$paymentMethods',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: {
            paymentMethods: {
              $ne: null,
            },
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: HOUR_DATE_FORMAT,
                  date: {
                    $toDate: {
                      $toLong: '$timestamp',
                    },
                  },
                },
              },
              method: {
                $concat: ['paymentMethods_', '$paymentMethods'],
              },
            },
            count: {
              $count: {},
            },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            items: {
              $addToSet: {
                k: '$_id.method',
                v: '$count',
              },
            },
          },
        },
        {
          $project: {
            items: {
              $arrayToObject: '$items',
            },
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                {
                  _id: '$_id',
                },
                '$items',
              ],
            },
          },
        },
        {
          $merge: {
            into: aggregatedHourlyCollectionName,
            whenMatched: 'merge',
          },
        },
      ]
    }

    // Hourly Stats
    await transactionsCollection
      .aggregate(getHitRulesAggregationPipeline('totalTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHitRulesAggregationPipeline('flaggedTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHitRulesAggregationPipeline('stoppedTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getHitRulesAggregationPipeline('suspendedTransactions'))
      .next()
    await transactionsCollection
      .aggregate(getPaymentMethodAggregationPipeline())
      .next()

    const getDerivedAggregationPipeline = (
      granularity: 'DAY' | 'MONTH',
      timeRange?: TimeRange
    ) => {
      let timestampMatch = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, granularity)
        const format =
          granularity === 'DAY' ? HOUR_DATE_FORMAT_JS : DAY_DATE_FORMAT_JS
        timestampMatch = {
          _id: {
            $gte: dayjs(start).format(format),
            $lt: dayjs(end).format(format),
          },
        }
      }
      return [
        { $match: { ...timestampMatch } },
        {
          $addFields: {
            time: {
              $substr: ['$_id', 0, granularity === 'DAY' ? 10 : 7],
            },
          },
        },
        {
          $group: {
            _id: '$time',
            totalTransactions: {
              $sum: '$totalTransactions',
            },
            flaggedTransactions: {
              $sum: '$flaggedTransactions',
            },
            stoppedTransactions: {
              $sum: '$stoppedTransactions',
            },
            suspendedTransactions: {
              $sum: '$suspendedTransactions',
            },
            ...PAYMENT_METHODS.reduce(
              (acc, x) => ({
                ...acc,
                [`paymentMethods_${x}`]: {
                  $sum: `$paymentMethods_${x}`,
                },
              }),
              {}
            ),
          },
        },
        {
          $merge: {
            into:
              granularity === 'DAY'
                ? aggregatedDailyCollectionName
                : aggregatedMonthlyCollectionName,
            whenMatched: 'merge',
          },
        },
      ]
    }

    // Daily stats
    await db
      .collection<DashboardStatsTransactionsCountData>(
        aggregatedHourlyCollectionName
      )
      .aggregate(getDerivedAggregationPipeline('DAY', timeRange))
      .next()

    // Monthly stats
    await db
      .collection<DashboardStatsTransactionsCountData>(
        aggregatedDailyCollectionName
      )
      .aggregate(getDerivedAggregationPipeline('MONTH', timeRange))
      .next()
  }

  public async refreshAllStats() {
    await Promise.all([
      this.refreshTransactionStats(),
      this.refreshCaseStats(),
      this.refreshUserStats(),
      this.refreshTeamStats(),
    ])
  }

  public async refreshTransactionStats(timeRange?: TimeRange) {
    const db = this.mongoDb.db()

    await Promise.all([
      this.recalculateTransactionsVolumeStats(db, timeRange),
      this.recalculateTransactionTypeDistribution(db, timeRange),
    ])
  }

  public async refreshCaseStats(timeRange?: TimeRange) {
    await Promise.all([
      this.recalculateRuleHitStats(timeRange),
      this.recalculateHitsByUser('ORIGIN', timeRange),
      this.recalculateHitsByUser('DESTINATION', timeRange),
      this.recalculateTeamStats(timeRange),
    ])
  }

  public async refreshUserStats() {
    const db = this.mongoDb.db()
    await this.recalculateDRSDistributionStats(db)
  }

  public async refreshTeamStats(timeRange?: TimeRange) {
    await this.recalculateTeamStats(timeRange)
  }

  public async getTransactionCountStats(
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType
  ): Promise<DashboardStatsTransactionsCountData[]> {
    const tenantId = this.tenantId
    const db = this.mongoDb.db()

    let collection
    let timeLabels: string[]
    let timeFormat: string

    if (granularity === granularityValues.DAY) {
      collection = db.collection<DashboardStatsTransactionsCountData>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_DAILY(tenantId)
      )
      timeLabels = getTimeLabels(
        DAY_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'DAY'
      )
      timeFormat = DAY_DATE_FORMAT_JS
    } else if (granularity === granularityValues.MONTH) {
      collection = db.collection<DashboardStatsTransactionsCountData>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_MONTHLY(tenantId)
      )
      timeLabels = getTimeLabels(
        MONTH_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'MONTH'
      )
      timeFormat = MONTH_DATE_FORMAT_JS
    } else {
      collection = db.collection<DashboardStatsTransactionsCountData>(
        DASHBOARD_TRANSACTIONS_STATS_COLLECTION_HOURLY(tenantId)
      )
      timeLabels = getTimeLabels(
        HOUR_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'HOUR'
      )
      timeFormat = HOUR_DATE_FORMAT_JS
    }

    const startDate = dayjs(startTimestamp).format(timeFormat)
    const endDate = dayjs(endTimestamp).format(timeFormat)

    const dashboardStats = await collection
      .find({
        _id: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ _id: 1 })
      .allowDiskUse()
      .toArray()

    const dashboardStatsById = keyBy(dashboardStats, '_id')
    return timeLabels.map((timeLabel) => {
      const stat = dashboardStatsById[timeLabel]
      return {
        _id: timeLabel,
        totalTransactions: stat?.totalTransactions ?? 0,
        flaggedTransactions: stat?.flaggedTransactions ?? 0,
        stoppedTransactions: stat?.stoppedTransactions ?? 0,
        suspendedTransactions: stat?.suspendedTransactions ?? 0,
        paymentMethods_ACH: stat?.paymentMethods_ACH ?? 0,
        paymentMethods_CARD: stat?.paymentMethods_CARD ?? 0,
        paymentMethods_GENERIC_BANK_ACCOUNT:
          stat?.paymentMethods_GENERIC_BANK_ACCOUNT ?? 0,
        paymentMethods_IBAN: stat?.paymentMethods_IBAN ?? 0,
        paymentMethods_SWIFT: stat?.paymentMethods_SWIFT ?? 0,
        paymentMethods_UPI: stat?.paymentMethods_UPI ?? 0,
        paymentMethods_WALLET: stat?.paymentMethods_WALLET ?? 0,
        paymentMethods_MPESA: stat?.paymentMethods_MPESA ?? 0,
        paymentMethods_CHECK: stat?.paymentMethods_CHECK ?? 0,
      }
    })
  }

  public async getHitsByUserStats(
    startTimestamp: number,
    endTimestamp: number,
    direction?: 'ORIGIN' | 'DESTINATION',
    userType?: 'BUSINESS' | 'CONSUMER'
  ): Promise<DashboardStatsHitsPerUserData[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<DashboardStatsTransactionsCountData>(
      DASHBOARD_HITS_BY_USER_STATS_COLLECTION_HOURLY(this.tenantId)
    )
    const startDate = dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
    const endDate = dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS)

    const condition = {
      $match: {
        ...(direction ? { direction } : {}),
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    }

    const totalRulesHits = await collection
      .aggregate<{
        _id: null
        totalRulesHits: number
      }>([
        condition,
        {
          $group: {
            _id: null,
            totalRulesHits: { $sum: '$rulesHit' },
          },
        },
      ])
      .next()
      .then((result) => result?.totalRulesHits ?? 0)

    const userTypeCondition = {
      $match: {
        'user.type': userType,
      },
    }

    const result = await collection
      .aggregate<{
        _id: string
        transactionsHit: number
        rulesHit: number
        user: InternalConsumerUser | InternalBusinessUser | null
        casesCount: number
        openCasesCount: number
      }>(
        [
          condition,
          {
            $group: {
              _id: `$userId`,
              transactionsHit: { $sum: '$transactionsHit' },
              rulesHit: { $sum: '$rulesHit' },
              casesCount: { $sum: '$casesCount' },
              openCasesCount: { $sum: '$openCasesCount' },
            },
          },
          {
            $sort: { rulesHit: -1 },
          },
          {
            $match: {
              rulesHit: {
                $gte: 1,
              },
            },
          },
          lookupPipelineStage(
            {
              from: USERS_COLLECTION(this.tenantId),
              localField: '_id',
              foreignField: 'userId',
              as: 'user',
            },
            true
          ),
          {
            $set: {
              user: { $first: '$user' },
            },
          },
          userTypeCondition,
          {
            $limit: 10,
          },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.map((x) => ({
      userId: x._id,
      user: x.user ?? undefined,
      transactionsHit: x.transactionsHit,
      rulesHit: x.rulesHit,
      casesCount: x.casesCount,
      openCasesCount: x.openCasesCount,
      percentageRulesHit: round((x.rulesHit / totalRulesHits) * 100, 2),
    }))
  }

  private createDistributionItems(
    riskClassificationValues: RiskClassificationScore[],
    buckets: WithId<DashboardStatsDRSDistributionData>[]
  ) {
    let total = 0
    buckets.map((bucket: any) => {
      total += bucket.count
    })
    const result: DRSDistributionStats[] = []
    buckets.map((bucket: any) => {
      riskClassificationValues.map(
        (classificationValue: RiskClassificationScore) => {
          if (bucket._id === classificationValue.lowerBoundRiskScore) {
            result.push({
              riskLevel: classificationValue.riskLevel,
              count: bucket.count,
              percentage: ((100 * bucket.count) / total).toFixed(2),
              riskScoreRange: `${classificationValue.lowerBoundRiskScore} - ${classificationValue.upperBoundRiskScore}`,
            })
          }
        }
      )
    })
    return result
  }

  public async getDRSDistributionStats(
    userType: 'BUSINESS' | 'CONSUMER'
  ): Promise<any> {
    const db = this.mongoDb.db()
    const collection = db.collection<{
      _id: string
      business: DashboardStatsDRSDistributionData[]
      consumer: DashboardStatsDRSDistributionData[]
    }>(DRS_SCORES_DISTRIBUTION_STATS_COLLECTION(this.tenantId))
    const dynamoDb = getDynamoDbClient()
    const riskRepository = new RiskRepository(this.tenantId, { dynamoDb })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    const result = await collection.find({}).toArray()
    const stats =
      userType === 'BUSINESS' ? result[0]?.business : result[0]?.consumer
    const distributionItems = this.createDistributionItems(
      riskClassificationValues,
      stats ?? []
    )

    return distributionItems
  }

  public async getRuleHitCountStats(
    startTimestamp: number,
    endTimestamp: number
  ): Promise<DashboardStatsRulesCountData[]> {
    const db = this.mongoDb.db()
    const collection = db.collection<DashboardStatsDRSDistributionData>(
      DASHBOARD_RULE_HIT_STATS_COLLECTION_HOURLY(this.tenantId)
    )

    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)

    const result = await collection
      .aggregate<{
        _id: { ruleId: string; ruleInstanceId: string }
        hitCount: number
        casesCount: number
        openCasesCount: number
      }>(
        [
          {
            $match: {
              _id: {
                $gt: startDateText,
                $lte: endDateText,
              },
            },
          },
          { $unwind: { path: '$rulesStats' } },
          {
            $group: {
              _id: {
                ruleId: '$rulesStats.ruleId',
                ruleInstanceId: '$rulesStats.ruleInstanceId',
              },
              hitCount: { $sum: '$rulesStats.hitCount' },
              casesCount: { $sum: '$rulesStats.casesCount' },
              openCasesCount: { $sum: '$rulesStats.openCasesCount' },
            },
          },
          { $sort: { hitCount: -1 } },
        ],
        { allowDiskUse: true }
      )
      .toArray()

    return result.map((x) => ({
      ruleId: x._id.ruleId,
      ruleInstanceId: x._id.ruleInstanceId,
      hitCount: x.hitCount,
      casesCount: x.casesCount,
      openCasesCount: x.openCasesCount,
    }))
  }

  async getTeamStatistics(
    scope: 'CASES' | 'ALERTS',
    startTimestamp?: number,
    endTimestamp?: number,
    status?: (CaseStatus | AlertStatus)[],
    accountIds?: Array<string>
  ): Promise<DashboardTeamStatsItem[]> {
    const db = this.mongoDb.db()
    const collectionName =
      scope === 'ALERTS'
        ? DASHBOARD_TEAM_ALERTS_STATS_HOURLY(this.tenantId)
        : DASHBOARD_TEAM_CASES_STATS_HOURLY(this.tenantId)

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

    const pipeline = [
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

    const result = await collection
      .aggregate<{
        accountId: string
        closedBy: number
        assignedTo: number
        caseIds: string[]
        investigationTime: number
        closedBySystem: number
        inProgress: number
        escalatedBy: number
      }>(pipeline, { allowDiskUse: true })
      .toArray()

    return result
  }

  async getOverviewStatistics(
    accountIds: string[]
  ): Promise<DashboardStatsOverview> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))

    const casesCount = await casesCollection.countDocuments({
      caseStatus: { $in: ['OPEN', 'REOPENED'] },
    })

    const alertsCount = await casesCollection
      .aggregate([
        {
          $match: {
            'alerts.alertStatus': {
              $in: ['OPEN', 'REOPENED'],
            },
          },
        },
        {
          $unwind: {
            path: '$alerts',
          },
        },
        {
          $match: {
            'alerts.alertStatus': {
              $in: ['OPEN', 'REOPENED'],
            },
          },
        },
        {
          $count: 'count',
        },
      ])
      .toArray()
    const dashboardCasesStatsHourlyCollection =
      db.collection<DashboardTeamStatsItem>(
        DASHBOARD_TEAM_CASES_STATS_HOURLY(this.tenantId)
      )
    const investigationTimePipeline = [
      {
        $match: {
          accountId: { $in: accountIds },
        },
      },
      {
        $group: {
          _id: null,
          caseIds: {
            $push: '$caseIds',
          },
          investigationTime: {
            $sum: '$investigationTime',
          },
        },
      },
      {
        $project: {
          _id: false,
          investigationTime: true,
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
          avgInvestigationTime: {
            $cond: {
              if: { $gt: [{ $size: '$caseIds' }, 0] },
              then: { $divide: ['$investigationTime', { $size: '$caseIds' }] },
              else: 0,
            },
          },
        },
      },
    ]
    const dashboardCasesStatsTotal = await dashboardCasesStatsHourlyCollection
      .aggregate<{ avgInvestigationTime: number }>(investigationTimePipeline)
      .toArray()
    const dashboardAlertsStatsCollection =
      db.collection<DashboardTeamStatsItem>(
        DASHBOARD_TEAM_ALERTS_STATS_HOURLY(this.tenantId)
      )
    const dashboardAlertsStatsTotal = await dashboardAlertsStatsCollection
      .aggregate<{ avgInvestigationTime: number }>(investigationTimePipeline)
      .toArray()
    let totalSarReported = 0
    if (hasFeature('SAR')) {
      const reportsCollection = db.collection<Report>(
        REPORT_COLLECTION(this.tenantId)
      )
      const queryFilter = { status: 'COMPLETE' }
      totalSarReported = await reportsCollection.countDocuments(queryFilter)
    }
    return {
      totalOpenCases: casesCount,
      totalOpenAlerts: alertsCount[0]?.count ?? 0,
      averageInvestigationTimeCases:
        dashboardCasesStatsTotal[0]?.avgInvestigationTime,
      averageInvestigationTimeAlerts:
        dashboardAlertsStatsTotal[0]?.avgInvestigationTime,
      totalSarReported,
    }
  }

  async getClosingReasonDistributionStatistics(
    entity?: 'CASE' | 'ALERT'
  ): Promise<DashboardStatsClosingReasonDistributionStats> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    let closingReasonsData: DashboardStatsClosingReasonDistributionStatsClosingReasonsData[] =
      []
    if (entity === 'CASE') {
      const reasons = await casesCollection
        .aggregate([
          {
            $match: { caseStatus: 'CLOSED' },
          },
          {
            $unwind: '$lastStatusChange.reason',
          },
          {
            $group: {
              _id: '$lastStatusChange.reason',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray()
      closingReasonsData = reasons.map((reason) => {
        return {
          reason: reason._id,
          value: reason.count,
        }
      })
    } else if (entity === 'ALERT') {
      const reasons = await casesCollection
        .aggregate([
          {
            $match: {
              'alerts.alertStatus': 'CLOSED',
              'alerts.lastStatusChange': { $ne: null },
            },
          },
          {
            $unwind: '$alerts',
          },
          {
            $project: {
              _id: false,
              lastStatusChange: '$alerts.lastStatusChange',
            },
          },
          {
            $unwind: '$lastStatusChange.reason',
          },
          {
            $group: {
              _id: '$lastStatusChange.reason',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray()
      closingReasonsData = reasons.map((reason) => {
        return {
          reason: reason._id,
          value: reason.count,
        }
      })
    }
    return {
      closingReasonsData: sortBy(closingReasonsData, 'reason'),
    }
  }
  async getAlertPriorityDistributionStatistics(): Promise<DashboardStatsAlertPriorityDistributionStats> {
    const db = this.mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(this.tenantId))
    const priorities = await casesCollection
      .aggregate([
        {
          $match: {
            'alerts.alertStatus': {
              $in: ['OPEN', 'REOPENED'],
            },
          },
        },
        {
          $unwind: '$alerts',
        },
        {
          $match: {
            'alerts.alertStatus': {
              $in: ['OPEN', 'REOPENED'],
            },
          },
        },
        {
          $project: {
            _id: false,
            alert: '$alerts',
          },
        },
        {
          $group: {
            _id: '$alert.priority',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()
    const alertPriorityData = priorities.map((priority) => {
      return {
        priority: priority._id,
        value: priority.count,
      }
    })
    return {
      alertPriorityData: sortBy(alertPriorityData, 'priority'),
    }
  }

  public async recalculateTransactionTypeDistribution(
    db: Db,
    timeRange?: TimeRange
  ) {
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(this.tenantId)
    )
    const aggregationCollection =
      TRANSACTION_TYPE_DISTRIBUTION_STATS_COLLECTION(this.tenantId)

    let timestampMatch = undefined
    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        timestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }
    await db.collection(aggregationCollection).createIndex(
      {
        type: 1,
      },
      {
        unique: true,
      }
    )
    await transactionsCollection
      .aggregate(
        [
          {
            $match: {
              ...timestampMatch,
              type: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: false,
              type: '$_id',
              value: '$count',
            },
          },
          {
            $merge: {
              into: aggregationCollection,
              on: ['type'],
              whenMatched: 'merge',
              whenNotMatched: 'insert',
            },
          },
        ],
        { allowDiskUse: true }
      )
      .next()

    logger.info(`Aggregation done`)
  }

  async getTransactionTypeDistributionStatistics(): Promise<DashboardStatsTransactionTypeDistributionStats> {
    const db = this.mongoDb.db()
    const collection =
      db.collection<DashboardStatsTransactionTypeDistributionStatsTransactionTypeData>(
        TRANSACTION_TYPE_DISTRIBUTION_STATS_COLLECTION(this.tenantId)
      )
    const result = await collection.find({}).toArray()
    const transactionTypeData: DashboardStatsTransactionTypeDistributionStatsTransactionTypeData[] =
      result.map((item) => {
        return {
          type: item.type,
          value: item.value,
        }
      })
    return {
      transactionTypeData,
    }
  }
}
