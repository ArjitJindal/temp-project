import { difference, uniq } from 'lodash'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { RiskClassificationScore } from '@/@types/openapi-internal/RiskClassificationScore'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { getRiskScoreBoundsFromLevel } from '@/services/risk-scoring/utils'
import { Comment } from '@/@types/openapi-internal/Comment'
import { CommentResponse } from '@/@types/openapi-public-management/CommentResponse'

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

export const getExternalComment = (comment: Comment): CommentResponse => {
  return {
    commentId: comment.id ?? '',
    body: comment.body,
    createdTimestamp: comment.createdAt,
    files: comment.files?.map((file) => ({
      filename: file.filename,
      size: file.size,
      downloadLink: file.downloadLink ?? '',
    })),
    updatedTimestamp: comment.updatedAt,
  }
}

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
