import { MongoClient } from 'mongodb'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { traceable } from '@/core/xray'
import { SanctionsScreeningStats } from '@/@types/openapi-internal/SanctionsScreeningStats'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'

@traceable
export class SanctionsActivityRepository {
  tenantId: string
  mongoDb: MongoClient

  constructor(tenantId: string, mongoDb: MongoClient) {
    this.tenantId = tenantId
    this.mongoDb = mongoDb
  }

  private extractStats(stats) {
    return {
      hit: stats.length ? stats[0].hit : 0,
      screened: stats.length ? stats[0].screened : 0,
    }
  }

  public async getSanctionsScreeningStats(): Promise<SanctionsScreeningStats> {
    const db = await getMongoDbClientDb()

    const usersCollection = db.collection<
      InternalBusinessUser | InternalConsumerUser
    >(USERS_COLLECTION(this.tenantId))
    const counterPartyUserstatsPromise = usersCollection
      .aggregate([
        {
          $unwind: '$executedRules',
        },
        {
          $match: {
            'executedRules.nature': 'SCREENING',
            'executedRules.ruleHitMeta.hitDirections': 'DESTINATION',
            'executedRules.ruleHitMeta.sanctionsDetails.entityType': {
              $ne: 'BANK_NAME',
            },
          },
        },
        {
          $group: {
            _id: '$userId',
            hit: {
              $sum: {
                $cond: {
                  if: { $eq: ['$executedRules.ruleHit', true] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
        {
          $group: {
            _id: 'counterPartyUser',
            screened: { $sum: 1 },
            hit: {
              $sum: {
                $cond: {
                  if: { $ne: ['$hit', 0] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
      ])
      .toArray()

    const userStatsPromise = usersCollection
      .aggregate([
        {
          $unwind: '$executedRules',
        },
        {
          $match: {
            'executedRules.nature': 'SCREENING',
            'executedRules.ruleHitMeta.hitDirections': 'ORIGIN',
            'executedRules.ruleHitMeta.sanctionsDetails.entityType': {
              $ne: 'BANK_NAME',
            },
          },
        },
        {
          $group: {
            _id: '$userId',
            hit: {
              $sum: {
                $cond: {
                  if: { $eq: ['$executedRules.ruleHit', true] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
        {
          $group: {
            _id: 'user',
            screened: { $sum: 1 },
            hit: {
              $sum: {
                $cond: {
                  if: { $ne: ['$hit', 0] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
      ])
      .toArray()

    const ibanStatsPromise = usersCollection
      .aggregate([
        {
          $unwind: '$executedRules',
        },
        {
          $match: {
            'executedRules.nature': 'SCREENING',
            'executedRules.ruleHitMeta.sanctionsDetails.entityType':
              'BANK_NAME',
          },
        },
        {
          $unwind: '$executedRules.ruleHitMeta.sanctionsDetails',
        },
        {
          $match: {
            'executedRules.ruleHitMeta.sanctionsDetails.iban': {
              $exists: true,
            },
          },
        },
        {
          $group: {
            _id: '$executedRules.ruleHitMeta.sanctionsDetails.iban',
            hit: {
              $sum: {
                $cond: {
                  if: { $eq: ['$executedRules.ruleHit', true] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
        {
          $group: {
            _id: 'iban',
            screened: { $sum: 1 },
            hit: {
              $sum: {
                $cond: {
                  if: { $ne: ['$hit', 0] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
      ])
      .toArray()

    const bankStatsPromise = usersCollection
      .aggregate([
        {
          $unwind: '$executedRules',
        },
        {
          $match: {
            'executedRules.nature': 'SCREENING',
            'executedRules.ruleHitMeta.sanctionsDetails.entityType':
              'BANK_NAME',
          },
        },
        {
          $unwind: '$executedRules.ruleHitMeta.sanctionsDetails',
        },
        {
          $group: {
            _id: '$executedRules.ruleHitMeta.sanctionsDetails.searchId',
            hit: {
              $sum: {
                $cond: {
                  if: { $eq: ['$executedRules.ruleHit', true] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
        {
          $group: {
            _id: 'bank',
            screened: { $sum: 1 },
            hit: {
              $sum: {
                $cond: {
                  if: { $ne: ['$hit', 0] },
                  then: 1,
                  else: 0,
                },
              },
            },
          },
        },
      ])
      .toArray()

    const [userStats, counterPartyUserStats, ibanStats, bankStats] =
      await Promise.all([
        userStatsPromise,
        counterPartyUserstatsPromise,
        ibanStatsPromise,
        bankStatsPromise,
      ])

    const user = this.extractStats(userStats)
    const counterPartyUser = this.extractStats(counterPartyUserStats)
    const iban = this.extractStats(ibanStats)
    const bank = this.extractStats(bankStats)
    return {
      user,
      bank,
      iban,
      counterPartyUser,
    }
  }
}
