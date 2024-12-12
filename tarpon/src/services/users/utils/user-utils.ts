import { difference, uniq } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils/risk'
import { WithId } from 'mongodb'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { hasFeature } from '@/core/utils/context'
import { AllUsersTableItem } from '@/@types/openapi-internal/AllUsersTableItem'
const internalUserAttributes = InternalUser.getAttributeTypeMap().map(
  (v) => v.name
)
const businessUserAttributes =
  BusinessWithRulesResult.getAttributeTypeMap().map((v) => v.name)
const consumerUserAttributes = UserWithRulesResult.getAttributeTypeMap().map(
  (v) => v.name
)

export const INTERNAL_ONLY_USER_ATTRIBUTES = difference(
  internalUserAttributes,
  uniq(businessUserAttributes.concat(consumerUserAttributes))
)

export const DYNAMO_ONLY_USER_ATTRIBUTES = businessUserAttributes.concat(
  consumerUserAttributes
)

export const getUsersFilterByRiskLevel = (
  filterRiskLevels: RiskLevel[],
  riskClassificationValues: RiskClassificationScore[]
) => {
  return {
    $or: [
      {
        'drsScore.manualRiskLevel': { $in: filterRiskLevels },
      },
      {
        $or: filterRiskLevels.map((riskLevel) => {
          const { lowerBoundRiskScore, upperBoundRiskScore } =
            getRiskScoreBoundsFromLevel(riskClassificationValues, riskLevel)
          return {
            'drsScore.drsScore': {
              $gte: lowerBoundRiskScore,
              $lt: upperBoundRiskScore,
            },
          }
        }),
      },
    ],
  }
}

export async function insertRiskScores(
  items:
    | WithId<InternalBusinessUser | InternalConsumerUser>[]
    | (InternalBusinessUser | InternalConsumerUser)[]
    | AllUsersTableItem[],
  riskClassificationValues: RiskClassificationScore[],
  riskRepository?: RiskRepository
) {
  const hasFeaturePNB = hasFeature('PNB')
  let drsScores: DrsScore[] = []
  let krsScores: KrsScore[] = []
  if (hasFeaturePNB && riskRepository) {
    ;[drsScores, krsScores] = await Promise.all([
      riskRepository.getDrsScores(items.map((user) => user.userId)),
      riskRepository.getKrsScores(items.map((user) => user.userId)),
    ])
  }
  const updatedItems = items.map((user) => {
    const drsScore = hasFeaturePNB
      ? drsScores.find((score) => score.userId === user.userId)
      : user?.drsScore
    const krsScore = hasFeaturePNB
      ? krsScores.find((score) => score.userId === user.userId)
      : user?.krsScore
    let newUser = user
    if (drsScore != null) {
      const derivedRiskLevel = drsScore?.manualRiskLevel
        ? undefined
        : getRiskLevelFromScore(riskClassificationValues, drsScore?.drsScore)
      const newDrsScore: DrsScore = {
        ...drsScore,
        derivedRiskLevel,
      }
      newUser = {
        ...newUser,
        drsScore: newDrsScore,
      }
    }

    if (krsScore != null) {
      const derivedRiskLevel = getRiskLevelFromScore(
        riskClassificationValues,
        krsScore?.krsScore
      )

      const newKrsScore: KrsScore = {
        ...krsScore,
        riskLevel: derivedRiskLevel,
      }

      newUser = {
        ...newUser,
        krsScore: newKrsScore,
      }
    }
    return newUser
  })
  return updatedItems
}
