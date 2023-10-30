import { getAffectedInterval, getTimeLabels } from '../../utils'
import { GranularityValuesType, TimeRange } from '../types'
import dayjs from '@/utils/dayjs'
import {
  DAY_DATE_FORMAT_JS,
  getMongoDbClientDb,
  HOUR_DATE_FORMAT,
  HOUR_DATE_FORMAT_JS,
  MONTH_DATE_FORMAT_JS,
} from '@/utils/mongodb-utils'
import {
  DASHBOARD_USERS_STATS_COLLECTION_DAILY,
  DASHBOARD_USERS_STATS_COLLECTION_HOURLY,
  DASHBOARD_USERS_STATS_COLLECTION_MONTHLY,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'

import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { DashboardStatsUsersByTimeItem } from '@/@types/openapi-internal/DashboardStatsUsersByTimeItem'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'

export class UserStats {
  public static async refresh(tenantId, timeRange?: TimeRange): Promise<void> {
    const dynamoDb = getDynamoDbClient()
    const riskRepository = new RiskRepository(tenantId, {
      dynamoDb,
    })
    const riskClassification =
      await riskRepository.getRiskClassificationValues()

    const db = await getMongoDbClientDb()
    const usersCollection = db.collection<InternalTransaction>(
      USERS_COLLECTION(tenantId)
    )
    const hourlyCollectionName =
      DASHBOARD_USERS_STATS_COLLECTION_HOURLY(tenantId)
    const dailyCollectionName = DASHBOARD_USERS_STATS_COLLECTION_DAILY(tenantId)
    const monthlyCollectionName =
      DASHBOARD_USERS_STATS_COLLECTION_MONTHLY(tenantId)

    function getAggregationPipeline(
      dateFormat: string,
      aggregationCollection: string
    ) {
      return [
        {
          $group: {
            _id: {
              type: '$type',
              date: {
                $dateToString: {
                  format: dateFormat,
                  date: {
                    $toDate: {
                      $toLong: '$createdTimestamp',
                    },
                  },
                },
              },
              krsScore: {
                $switch: {
                  branches: riskClassification.map((item) => ({
                    case: {
                      $and: [
                        {
                          $gte: [
                            '$krsScore.krsScore',
                            item.lowerBoundRiskScore,
                          ],
                        },
                        {
                          $lt: ['$krsScore.krsScore', item.upperBoundRiskScore],
                        },
                      ],
                    },
                    then: item.riskLevel,
                  })),
                  default: 'LOW',
                },
              },
              drsScore: {
                $switch: {
                  branches: riskClassification.map((item) => ({
                    case: {
                      $and: [
                        {
                          $gte: [
                            '$drsScore.drsScore',
                            item.lowerBoundRiskScore,
                          ],
                        },
                        {
                          $lt: ['$drsScore.drsScore', item.upperBoundRiskScore],
                        },
                      ],
                    },
                    then: item.riskLevel,
                  })),
                  default: 'LOW',
                },
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $addFields:
            /**
             * newField: The new field name.
             * expression: The new field expression.
             */
            {
              date: '$_id.date',
              type: '$_id.type',
              krsScore: '$_id.krsScore',
              drsScore: '$_id.drsScore',
              count: '$count',
            },
        },
        {
          $merge: {
            into: aggregationCollection,
            on: ['date', 'type', 'krsScore', 'drsScore'],
            whenMatched: 'merge',
          },
        },
      ]

      // todo: implement cleaning?
      // const lastUpdatedAt = Date.now()
      // await usersCollection
      //   .aggregate(withUpdatedAt(pipeline, lastUpdatedAt), { allowDiskUse: true })
      //   .next()
      // await cleanUpStaleData(aggregationCollection, 'date', lastUpdatedAt)
    }

    await usersCollection
      .aggregate(getAggregationPipeline(HOUR_DATE_FORMAT, hourlyCollectionName))
      .next()

    const getDerivedAggregationPipeline = (
      granularity: 'DAY' | 'MONTH',
      timeRange?: TimeRange
    ) => {
      let timestampMatch: any = undefined
      if (timeRange) {
        const { start, end } = getAffectedInterval(timeRange, granularity)
        const format =
          granularity === 'DAY' ? HOUR_DATE_FORMAT_JS : DAY_DATE_FORMAT_JS
        timestampMatch = {
          date: {
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
              $substr: ['$date', 0, granularity === 'DAY' ? 10 : 7],
            },
          },
        },
        {
          $group: {
            _id: {
              date: '$time',
              krsScore: '$krsScore',
              drsScore: '$drsScore',
              type: '$type',
            },
            count: { $sum: '$count' },
          },
        },

        {
          $project: {
            date: '$_id.date',
            type: '$_id.type',
            krsScore: '$_id.krsScore',
            drsScore: '$_id.drsScore',
            count: '$count',
          },
        },
        {
          $merge: {
            into:
              granularity === 'DAY'
                ? dailyCollectionName
                : monthlyCollectionName,
            on: ['date', 'type', 'krsScore', 'drsScore'],
            whenMatched: 'merge',
          },
        },
      ]
    }

    await db
      .collection<DashboardStatsUsersByTimeItem>(hourlyCollectionName)
      .aggregate(getDerivedAggregationPipeline('DAY', timeRange))
      .next()

    await db
      .collection<DashboardStatsUsersByTimeItem>(dailyCollectionName)
      .aggregate(getDerivedAggregationPipeline('MONTH', timeRange))
      .next()
  }

  public static async get(
    tenantId: string,
    userType: 'BUSINESS' | 'CONSUMER',
    startTimestamp: number,
    endTimestamp: number,
    granularity?: GranularityValuesType
  ): Promise<DashboardStatsUsersByTimeItem[]> {
    const db = await getMongoDbClientDb()

    let collection
    let timeLabels: string[]
    let timeFormat: string

    if (granularity === 'DAY') {
      collection = db.collection<DashboardStatsUsersByTimeItem>(
        DASHBOARD_USERS_STATS_COLLECTION_DAILY(tenantId)
      )
      timeLabels = getTimeLabels(
        DAY_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'DAY'
      )
      timeFormat = DAY_DATE_FORMAT_JS
    } else if (granularity === 'MONTH') {
      collection = db.collection<DashboardStatsUsersByTimeItem>(
        DASHBOARD_USERS_STATS_COLLECTION_MONTHLY(tenantId)
      )
      timeLabels = getTimeLabels(
        MONTH_DATE_FORMAT_JS,
        startTimestamp,
        endTimestamp,
        'MONTH'
      )
      timeFormat = MONTH_DATE_FORMAT_JS
    } else {
      collection = db.collection<DashboardStatsUsersByTimeItem>(
        DASHBOARD_USERS_STATS_COLLECTION_HOURLY(tenantId)
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

    function makePipeline(riskType: 'KRS' | 'DRS') {
      const pipeline = [
        {
          $match: {
            type: userType,
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: {
              date: '$date',
              riskLevel: riskType === 'KRS' ? '$krsScore' : '$drsScore',
            },
            count: {
              $sum: '$count',
            },
          },
        },
        {
          $project: {
            _id: '$_id.date',
            riskType: riskType,
            riskLevel: '$_id.riskLevel',
            count: '$count',
          },
        },
      ]
      return pipeline
    }

    const krsStats = await collection.aggregate(makePipeline('KRS')).toArray()
    const krsStatsById = krsStats?.reduce(
      (acc, x) => ({ ...acc, [x._id]: x }),
      {}
    )

    const drsStats = await collection.aggregate(makePipeline('DRS')).toArray()
    const drsStatsById = drsStats?.reduce(
      (acc, x) => ({ ...acc, [x._id]: x }),
      {}
    )

    return timeLabels.map((timeLabel) => {
      const krsStat = krsStatsById[timeLabel]
      const drsStat = drsStatsById[timeLabel]
      return {
        _id: timeLabel,
        ...RISK_LEVELS.reduce(
          (acc, x) => ({
            ...acc,
            [`krsRiskLevel_${x}`]:
              krsStat?.riskLevel === x ? krsStat?.count : 0,
          }),
          {}
        ),
        ...RISK_LEVELS.reduce(
          (acc, x) => ({
            ...acc,
            [`drsRiskLevel_${x}`]:
              drsStat?.riskLevel === x ? drsStat?.count : 0,
          }),
          {}
        ),
      }
    })
  }
}
