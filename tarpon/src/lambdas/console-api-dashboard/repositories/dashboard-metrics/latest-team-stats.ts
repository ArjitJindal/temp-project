import { difference } from 'lodash'
import { TimeRange } from '../types'
import { getAffectedInterval } from '../../utils'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import {
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  getMongoDbClientDb,
} from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY,
  DASHBOARD_TEAM_ALERTS_STATS_HOURLY,
  DASHBOARD_TEAM_CASES_STATS_HOURLY,
} from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { DashboardLatestTeamStatsItem } from '@/@types/openapi-internal/DashboardLatestTeamStatsItem'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CASE_STATUSS } from '@/@types/openapi-internal-custom/CaseStatus'
import { isStatusInReview, statusEscalated } from '@/utils/helpers'

@traceable
export class LatestTeamStatsDashboardMetric {
  private static getStatusAccordingToAssignment(
    key: 'assignemnts' | 'reviewAssignments'
  ): CaseStatus[] {
    const reviewAssignmentsStatus = CASE_STATUSS.filter(
      (status) => statusEscalated(status) || isStatusInReview(status)
    )
    const assignmentsStatus = difference(CASE_STATUSS, reviewAssignmentsStatus)
    return key === 'reviewAssignments'
      ? reviewAssignmentsStatus
      : assignmentsStatus
  }
  public static async refresh(
    tenantId,
    caseCreatedAtTimeRange?: TimeRange
  ): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const alertAggregationCollection =
      DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(tenantId)
    const caseAggregationCollection =
      DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(tenantId)

    const lastUpdatedAt = Date.now()
    let timestampMatch: any = null
    if (caseCreatedAtTimeRange) {
      const { start, end } = getAffectedInterval(caseCreatedAtTimeRange, 'HOUR')
      timestampMatch = {
        createdTimestamp: {
          $gte: start,
          $lt: end,
        },
      }
    }
    // Cases
    {
      await db
        .collection(caseAggregationCollection)
        .createIndex({ date: -1, accountId: 1 }, { unique: true })

      {
        const assignmentsPipeline = [
          {
            $match: {
              ...timestampMatch,
              caseStatus: {
                $in: this.getStatusAccordingToAssignment('assignemnts'),
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
              },
              open: {
                $sum: {
                  $cond: [{ $in: ['$caseStatus', ['OPEN', 'REOPENED']] }, 1, 0],
                },
              },
              closed: {
                $sum: {
                  $cond: [{ $eq: ['$caseStatus', 'CLOSED'] }, 1, 0],
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
              date: '$_id.date',
              inProgress: 1,
              closed: 1,
              onHold: 1,
              open: 1,
            },
          },
          {
            $merge: {
              into: caseAggregationCollection,
              on: ['accountId', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        const reviewAssignmentspipeline = [
          {
            $match: {
              ...timestampMatch,
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
              },
              escalated: {
                $sum: {
                  $cond: [{ $eq: ['$caseStatus', 'ESCALATED'] }, 1, 0],
                },
              },
              inProgress: {
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
              onHold: {
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
              date: '$_id.date',
              inProgress: 1,
              escalated: 1,
              onHold: 1,
              inReview: 1,
            },
          },
          {
            $merge: {
              into: caseAggregationCollection,
              on: ['accountId', 'date'],
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
        .createIndex({ date: -1, accountId: 1 }, { unique: true })

      {
        const assignmentsPipeline = [
          {
            $match: {
              ...timestampMatch,
              'alerts.alertStatus': {
                $in: this.getStatusAccordingToAssignment('assignemnts'),
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
            },
          },
          {
            $group: {
              _id: {
                accountId: '$alerts.assignments.assigneeUserId',
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
              closed: {
                $sum: {
                  $cond: [{ $eq: ['$alerts.alertStatus', 'CLOSED'] }, 1, 0],
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
              date: '$_id.date',
              inProgress: 1,
              closed: 1,
              onHold: 1,
              open: 1,
            },
          },
          {
            $merge: {
              into: alertAggregationCollection,
              on: ['accountId', 'date'],
              whenMatched: 'merge',
            },
          },
        ]

        const reviewAssignmentspipeline = [
          {
            $match: {
              ...timestampMatch,
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
              },
              escalated: {
                $sum: {
                  $cond: [{ $eq: ['$alerts.alertStatus', 'ESCALATED'] }, 1, 0],
                },
              },
              inProgress: {
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
              onHold: {
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
              date: '$_id.date',
              inProgress: 1,
              escalated: 1,
              onHold: 1,
              inReview: 1,
            },
          },
          {
            $merge: {
              into: alertAggregationCollection,
              on: ['accountId', 'date'],
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

    await Promise.all([
      cleanUpStaleData(
        caseAggregationCollection,
        'date',
        lastUpdatedAt,
        caseCreatedAtTimeRange,
        'HOUR'
      ),
      cleanUpStaleData(
        alertAggregationCollection,
        'date',
        lastUpdatedAt,
        caseCreatedAtTimeRange,
        'HOUR'
      ),
    ])
  }

  public static async get(
    tenantId: string,
    scope: 'CASES' | 'ALERTS',
    accountIds?: Array<string>
  ): Promise<DashboardLatestTeamStatsItem[]> {
    const db = await getMongoDbClientDb()
    const collectionName =
      scope === 'ALERTS'
        ? DASHBOARD_LATEST_TEAM_ALERTS_STATS_HOURLY(tenantId)
        : DASHBOARD_LATEST_TEAM_CASES_STATS_HOURLY(tenantId)
    const collection =
      db.collection<DashboardLatestTeamStatsItem>(collectionName)
    const startTimestamp = 0
    const endTimestamp = Date.now()
    const dateCondition: Record<string, unknown> = {
      $gte: dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS),
      $lte: dayjs(endTimestamp).format(HOUR_DATE_FORMAT_JS),
    }

    const matchConditions: Record<string, unknown>[] = []
    if (dateCondition != null) {
      matchConditions.push({ date: dateCondition })
    }
    if (accountIds != null && accountIds.length > 0) {
      matchConditions.push({ accountId: { $in: accountIds } })
    }

    const pipeline = [
      ...(matchConditions.length > 0
        ? [{ $match: { $and: matchConditions } }]
        : []),
      {
        $group: {
          _id: '$accountId',
          closed: {
            $sum: '$closed',
          },
          open: {
            $sum: '$open',
          },
          caseIds: {
            $push: '$caseIds',
          },
          onHold: {
            $sum: '$onHold',
          },
          inProgress: {
            $sum: '$inProgress',
          },
          escalated: {
            $sum: '$escalated',
          },
          inReview: {
            $sum: '$inReview',
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
          closed: true,
          open: true,
          caseIds: true,
          inReview: true,
          inProgress: true,
          escalated: true,
          onHold: true,
        },
      },
    ]

    const investigationTimeCollectionName =
      scope === 'ALERTS'
        ? DASHBOARD_TEAM_ALERTS_STATS_HOURLY(tenantId)
        : DASHBOARD_TEAM_CASES_STATS_HOURLY(tenantId)

    const investigationTimeCollection = db.collection(
      investigationTimeCollectionName
    )
    const investigationTimePipeline = [
      ...(matchConditions.length > 0
        ? [{ $match: { $and: matchConditions } }]
        : []),
      {
        $group: {
          _id: '$accountId',
          investigationTime: {
            $sum: '$investigationTime',
          },
          caseIds: {
            $push: '$caseIds',
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
          investigationTime: true,
          caseIds: true,
        },
      },
    ]

    const investigationTimeResultPromise = investigationTimeCollection
      .aggregate<{
        accountId: string
        investigationTime: number
        caseIds: string[]
      }>(investigationTimePipeline, { allowDiskUse: true })
      .toArray()

    const resultPromise = collection
      .aggregate<{
        accountId: string
        closed: number
        open: number
        inReview: number
        inProgress: number
        escalated: number
        onHold: number
      }>(pipeline, { allowDiskUse: true })
      .toArray()

    const [investigationTimeResult, result] = await Promise.all([
      investigationTimeResultPromise,
      resultPromise,
    ])
    const investigationTimeMap = new Map()
    investigationTimeResult.forEach((item) => {
      investigationTimeMap.set(item.accountId, {
        investigationTime: item.investigationTime,
        caseIdsCount: item.caseIds.length,
      })
    })
    return result.map((item) => {
      const investigationTimeData = investigationTimeMap.get(item.accountId)
      if (!investigationTimeData) {
        return item
      }
      const { investigationTime, caseIdsCount } = investigationTimeData
      return {
        ...item,
        avgInvestigationTime: investigationTime / caseIdsCount,
      }
    })
  }
}
