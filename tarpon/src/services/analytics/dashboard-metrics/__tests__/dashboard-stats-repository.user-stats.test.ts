import { nanoid } from 'nanoid'
import { isNil, omitBy } from 'lodash'
import { getRiskRepo, getStatsRepo, getUserRepo } from './helpers'
import dayjs from '@/utils/dayjs'
import { getTestUser } from '@/test-utils/user-test-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { RiskLevel } from '@/@types/openapi-public/RiskLevel'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { DashboardStatsRepository } from '@/services/dashboard/repositories/dashboard-stats-repository'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { USER_TYPES, UserType } from '@/@types/user/user-type'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { withFeaturesToggled } from '@/test-utils/feature-test-utils'
import { hasFeature } from '@/core/utils/context'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

type RiskType = 'KRS' | 'DRS'
dynamoDbSetupHook()
withFeaturesToggled(['RISK_SCORING'], ['CLICKHOUSE_ENABLED'], () => {
  describe.each<RiskType>(['KRS', 'DRS'])('Risk type: %s', (riskType) => {
    describe.each<UserType>(USER_TYPES)('User type: %s', (userType) => {
      describe('Env #1 (empty)', () => {
        let TENANT_ID: string
        beforeAll(async () => {
          TENANT_ID = getTestTenantId()
        })
        test(`Empty db`, async () => {
          if (hasFeature('CLICKHOUSE_ENABLED')) {
            // ASSUMING USERS TABLE WILL EXIST
            return
          }
          const statsRepository = await getStatsRepo(TENANT_ID)
          const result = await statsRepository.getUserTimewindowStats(
            userType,
            ts('2023-01-01T00:00:00.000Z'),
            ts('2023-03-01T00:00:00.000Z'),
            'MONTH'
          )
          expect(result).toEqual([
            expectedStats(riskType, '2023-01', {}),
            expectedStats(riskType, '2023-02', {}),
            expectedStats(riskType, '2023-03', {}),
          ])
        })
      })

      describe('Env #2 (5 users for each risk level in one month)', () => {
        let TENANT_ID: string
        let statsRepository: DashboardStatsRepository
        beforeAll(async () => {
          TENANT_ID = await getTestTenantId()
          const usersRepo = await getUserRepo(TENANT_ID)
          const riskRepo = await getRiskRepo(TENANT_ID)
          const riskLevels = await getRiskScores(riskRepo)
          for (let i = 0; i < RISK_LEVELS.length; i += 1) {
            const riskLevel = RISK_LEVELS[i]
            for (let j = 0; j < 5; j += 1) {
              await usersRepo.saveUserMongo(
                makeUser(userType, ts(`2023-01-01T0${i + 1}:0${j}:00.000Z`), {
                  riskType,
                  score: riskLevels[riskLevel],
                })
              )
            }
          }
          statsRepository = await getStatsRepo(TENANT_ID)
          await statsRepository.refreshUserStats()
        })
        test(`Check by hours`, async () => {
          const result = await statsRepository.getUserTimewindowStats(
            userType,
            dayjs('2023-01-01T00:00:00.000Z').valueOf(),
            dayjs('2023-01-31T00:00:00.000Z').valueOf(),
            'HOUR'
          )
          expect(result).toEqual(
            expect.arrayContaining([
              expectedStats(riskType, '2023-01-01T00', {}),
              expectedStats(riskType, '2023-01-01T01', {
                VERY_HIGH: 5,
              }),
              expectedStats(riskType, '2023-01-01T02', {
                HIGH: 5,
              }),
              expectedStats(riskType, '2023-01-01T03', {
                MEDIUM: 5,
              }),
              expectedStats(riskType, '2023-01-01T04', {
                LOW: 5,
              }),
              expectedStats(riskType, '2023-01-01T05', {
                VERY_LOW: 5,
              }),
              expectedStats(riskType, '2023-01-01T06', {}),
            ])
          )
        })
        test(`Check one month`, async () => {
          const result = await statsRepository.getUserTimewindowStats(
            userType,
            dayjs('2023-01-01T00:00:00.000Z').valueOf(),
            dayjs('2023-01-31T00:00:00.000Z').valueOf(),
            'MONTH'
          )
          expect(result).toEqual([
            expectedStats(riskType, '2023-01', {
              VERY_LOW: 5,
              LOW: 5,
              MEDIUM: 5,
              HIGH: 5,
              VERY_HIGH: 5,
            }),
          ])
        })
        test(`Check 3 months`, async () => {
          const result = await statsRepository.getUserTimewindowStats(
            userType,
            dayjs('2023-01-01T00:00:00.000Z').valueOf(),
            dayjs('2023-03-31T00:00:00.000Z').valueOf(),
            'MONTH'
          )
          expect(result).toEqual([
            expectedStats(riskType, '2023-01', {
              VERY_LOW: 5,
              LOW: 5,
              MEDIUM: 5,
              HIGH: 5,
              VERY_HIGH: 5,
            }),
            expectedStats(riskType, '2023-02', {}),
            expectedStats(riskType, '2023-03', {}),
          ])
        })
      })
      describe('Env #3 (5 same risk level every month)', () => {
        let TENANT_ID: string
        let statsRepository: DashboardStatsRepository
        beforeAll(async () => {
          TENANT_ID = await getTestTenantId()
          const usersRepo = await getUserRepo(TENANT_ID)
          const riskRepo = await getRiskRepo(TENANT_ID)
          const riskLevels = await getRiskScores(riskRepo)
          const users = [
            makeUser(userType, ts('2023-01-01T00:00:00.000Z'), {
              riskType,
              score: riskLevels.VERY_HIGH,
            }),
            makeUser(userType, ts('2023-02-01T00:00:00.000Z'), {
              riskType,
              score: riskLevels.VERY_HIGH,
            }),
            makeUser(userType, ts('2023-03-01T00:00:00.000Z'), {
              riskType,
              score: riskLevels.VERY_HIGH,
            }),
            makeUser(userType, ts('2023-04-01T00:00:00.000Z'), {
              riskType,
              score: riskLevels.VERY_HIGH,
            }),
            makeUser(userType, ts('2023-05-01T00:00:00.000Z'), {
              riskType,
              score: riskLevels.VERY_HIGH,
            }),
          ]
          for (const user of users) {
            await usersRepo.saveUserMongo(user)
          }
          statsRepository = await getStatsRepo(TENANT_ID)
          await statsRepository.refreshUserStats()
        })
        test(`Check one month`, async () => {
          const result = await statsRepository.getUserTimewindowStats(
            userType,
            dayjs('2023-01-01T00:00:00.000Z').valueOf(),
            dayjs('2023-01-31T00:00:00.000Z').valueOf(),
            'MONTH'
          )
          expect(result).toEqual([
            expectedStats(riskType, '2023-01', {
              VERY_HIGH: 1,
            }),
          ])
        })
        test(`Check 5 months`, async () => {
          const result = await statsRepository.getUserTimewindowStats(
            userType,
            dayjs('2023-01-01T00:00:00.000Z').valueOf(),
            dayjs('2023-05-30T00:00:00.000Z').valueOf(),
            'MONTH'
          )
          expect(result).toEqual([
            expectedStats(riskType, '2023-01', {
              VERY_HIGH: 1,
            }),
            expectedStats(riskType, '2023-02', {
              VERY_HIGH: 1,
            }),
            expectedStats(riskType, '2023-03', {
              VERY_HIGH: 1,
            }),
            expectedStats(riskType, '2023-04', {
              VERY_HIGH: 1,
            }),
            expectedStats(riskType, '2023-05', {
              VERY_HIGH: 1,
            }),
          ])
        })
      })
    })
  })
})
/*
  Helpers
 */
async function getRiskScores(
  riskRepo: RiskRepository
): Promise<{ [key in RiskLevel]: number }> {
  const riskClassification = await riskRepo.getRiskClassificationValues()
  return riskClassification.reduce(
    (acc, x): { [key in RiskLevel]: number } => ({
      ...acc,
      [x.riskLevel]:
        x.lowerBoundRiskScore +
        (x.upperBoundRiskScore - x.lowerBoundRiskScore) / 2,
    }),
    {
      VERY_HIGH: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      VERY_LOW: 0,
    }
  )
}
function ts(string: string): number {
  return dayjs(string).valueOf()
}
function makeUser(
  type: UserType,
  ts: number,
  risks: {
    riskType: RiskType
    score: number
  }
): InternalUser {
  const testUser = getTestUser({
    userId: nanoid(),
    createdTimestamp: ts,
  }) as InternalBusinessUser | InternalConsumerUser
  const { riskType, score } = risks
  return {
    ...testUser,
    type,
    drsScore:
      riskType === 'DRS'
        ? {
            isUpdatable: false,
            ...testUser.drsScore,
            drsScore: score,
            createdAt: ts,
          }
        : testUser.drsScore,
    krsScore:
      riskType === 'KRS'
        ? {
            ...testUser.krsScore,
            krsScore: score,
            createdAt: ts,
          }
        : testUser.krsScore,
  } as InternalUser
}

function expectedStats(
  riskType: RiskType,
  date: string,
  stats: {
    HIGH?: number
    LOW?: number
    MEDIUM?: number
    VERY_HIGH?: number
    VERY_LOW?: number
  }
) {
  return expect.objectContaining(
    omitBy(
      {
        time: date,
        [`${riskType.toLowerCase()}RiskLevel_HIGH`]: stats.HIGH,
        [`${riskType.toLowerCase()}RiskLevel_LOW`]: stats.LOW,
        [`${riskType.toLowerCase()}RiskLevel_MEDIUM`]: stats.MEDIUM,
        [`${riskType.toLowerCase()}RiskLevel_VERY_HIGH`]: stats.VERY_HIGH,
        [`${riskType.toLowerCase()}RiskLevel_VERY_LOW`]: stats.VERY_LOW,
      },
      isNil
    )
  )
}
