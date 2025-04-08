import { getAffectedInterval } from '../../dashboard/utils'
import { TimeRange } from '../../dashboard/repositories/types'
import { cleanUpStaleData, withUpdatedAt } from './utils'
import dayjs from '@/utils/dayjs'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { HOUR_DATE_FORMAT, HOUR_DATE_FORMAT_JS } from '@/core/constants'
import {
  CASES_COLLECTION,
  CHECKLIST_TEMPLATE_COLLECTION,
  DASHBOARD_QA_ALERTS_BY_CHECKLIST_REASON_COLLECTION_HOURLY,
} from '@/utils/mongodb-definitions'

import { Case } from '@/@types/openapi-internal/Case'
import { traceable } from '@/core/xray'
import { ChecklistTemplate } from '@/@types/openapi-internal/ChecklistTemplate'
import { DashboardStatsQaAlertsStatsByChecklistReasonData } from '@/@types/openapi-internal/DashboardStatsQaAlertsStatsByChecklistReasonData'

@traceable
export class QaAlertsByChecklistReasonStatsDashboardMetric {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
    const db = await getMongoDbClientDb()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
    const aggregationCollection =
      DASHBOARD_QA_ALERTS_BY_CHECKLIST_REASON_COLLECTION_HOURLY(tenantId)
    let timestampMatch: any = undefined

    if (timeRange) {
      const { start, end } = getAffectedInterval(timeRange, 'HOUR')
      timestampMatch = {
        'alerts.updatedAt': {
          $gte: start,
          $lt: end,
        },
      }
    }

    const pipeline = [
      { $match: { ...timestampMatch } },
      {
        $unwind: {
          path: '$alerts',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          'alerts.alertStatus': 'CLOSED',
          'alerts.ruleQaStatus': { $ne: null },
          ...timestampMatch,
        },
      },
      {
        $unwind: {
          path: '$alerts.ruleChecklist',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: CHECKLIST_TEMPLATE_COLLECTION(tenantId),
          let: {
            checklistTemplateId: '$alerts.ruleChecklistTemplateId',
            ruleChecklistItemId: '$alerts.ruleChecklist.checklistItemId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$id', '$$checklistTemplateId'] }],
                },
              },
            },
            {
              $unwind: {
                path: '$categories',
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $unwind: {
                path: '$categories.checklistItems',
                preserveNullAndEmptyArrays: false,
              },
            },
            {
              $match: {
                $expr: {
                  $eq: [
                    '$$ruleChecklistItemId',
                    '$categories.checklistItems.id',
                  ],
                },
              },
            },
            {
              $project: {
                'categories.name': 1,
              },
            },
          ],
          as: 'ruleChecklistCategory',
        },
      },
      {
        $addFields: {
          'alerts.ruleChecklistCategory': {
            $arrayElemAt: ['$ruleChecklistCategory', 0],
          },
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
                    $toLong: '$alerts.updatedAt',
                  },
                },
              },
            },
            checklistTemplateId: '$alerts.ruleChecklistTemplateId',
            checklistTemplateCategory:
              '$alerts.ruleChecklistCategory.categories.name',
            checklistItemId: '$alerts.ruleChecklist.checklistItemId',
          },
          totalQaPassedAlerts: {
            $sum: {
              $cond: {
                if: { $eq: ['$alerts.ruleQaStatus', 'PASSED'] },
                then: 1,
                else: 0,
              },
            },
          },
          totalQaFailedAlerts: {
            $sum: {
              $cond: {
                if: { $eq: ['$alerts.ruleQaStatus', 'FAILED'] },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.time',
          alertsStats: {
            $push: {
              checklistTemplateId: '$_id.checklistTemplateId',
              checklistTemplateCategory: '$_id.checklistTemplateCategory',
              checklistItemId: '$_id.checklistItemId',
              totalQaPassedAlerts: '$totalQaPassedAlerts',
              totalQaFailedAlerts: '$totalQaFailedAlerts',
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

    const lastUpdatedAt = Date.now()
    await casesCollection
      .aggregate(withUpdatedAt(pipeline, lastUpdatedAt))
      .next()

    await cleanUpStaleData(
      aggregationCollection,
      '_id',
      lastUpdatedAt,
      timeRange,
      'HOUR'
    )
  }

  public static async get(
    tenantId: string,
    startTimestamp: number,
    endTimestamp: number,
    checklistTemplateId: string,
    checklistCategory: string
  ): Promise<DashboardStatsQaAlertsStatsByChecklistReasonData[]> {
    const db = await getMongoDbClientDb()
    const collection = db.collection(
      DASHBOARD_QA_ALERTS_BY_CHECKLIST_REASON_COLLECTION_HOURLY(tenantId)
    )

    const endDate = dayjs(endTimestamp)
    const endDateText: string = endDate.format(HOUR_DATE_FORMAT_JS)
    const startDateText: string =
      dayjs(startTimestamp).format(HOUR_DATE_FORMAT_JS)
    const checklistCollection = db.collection<ChecklistTemplate>(
      CHECKLIST_TEMPLATE_COLLECTION(tenantId)
    )
    const checklist = await checklistCollection.findOne({
      id: checklistTemplateId,
    })

    const result = await collection
      .aggregate(
        [
          {
            $match: {
              _id: {
                $gt: startDateText,
                $lte: endDateText,
              },
            },
          },
          { $unwind: { path: '$alertsStats' } },
          {
            $match: {
              'alertsStats.checklistTemplateId': checklistTemplateId,
              'alertsStats.checklistTemplateCategory': checklistCategory,
            },
          },
          {
            $group: {
              _id: {
                checklistTemplateId: '$alertsStats.checklistTemplateId',
                checklistTemplateCategory:
                  '$alertsStats.checklistTemplateCategory',
                checklistItemId: '$alertsStats.checklistItemId',
              },
              totalQaPassedAlerts: { $sum: '$alertsStats.totalQaPassedAlerts' },
              totalQaFailedAlerts: { $sum: '$alertsStats.totalQaFailedAlerts' },
            },
          },
          {
            $match: {
              $or: [
                { totalQaPassedAlerts: { $gt: 0 } },
                { totalQaFailedAlerts: { $gt: 0 } },
              ],
            },
          },
        ],
        { allowDiskUse: true }
      )
      .toArray()
    return result.map((x) => ({
      checklistTemplateId: x._id.checklistTemplateId,
      checklistTemplateCategory: x._id.checklistTemplateCategory,
      checklistItemId: x._id.checklistItemId,
      totalQaPassedAlerts: x.totalQaPassedAlerts,
      totalQaFailedAlerts: x.totalQaFailedAlerts,
      checklistItemReason: checklist?.categories
        .find((category) => category.name === checklistCategory)
        ?.checklistItems.find((item) => item.id === x._id.checklistItemId)
        ?.name,
    }))
  }
}
