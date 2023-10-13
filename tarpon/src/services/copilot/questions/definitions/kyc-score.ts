import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { KRS_SCORES_COLLECTION } from '@/utils/mongodb-definitions'
import { searchUser } from '@/services/copilot/questions/definitions/common/search'
import { queryUsername } from '@/services/copilot/questions/definitions/util'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
export const KycScoring: TableQuestion<{ userId: string }> = {
  type: 'TABLE',
  questionId: 'KYC Scoring',
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ userId }) => {
    return `KYC risk score (KRS) for ${await queryUsername(userId)}`
  },
  aggregationPipeline: async ({ tenantId }, { userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const krsScore = await db
      .collection<KrsScore>(KRS_SCORES_COLLECTION(tenantId))
      .findOne({ userId })

    const displayNames = {
      type: 'Customer type',
      'legalEntity.companyGeneralDetails.userRegistrationStatus':
        'User registration status',
      'legalEntity.companyRegistrationDetails.registrationCountry':
        'Business registration country',
      'legalEntity.companyGeneralDetails.userSegment': 'User segment',
      'userDetails.countryOfNationality': 'Country of nationality',
      'userDetails.dateOfBirth': 'Customer age',
      'userDetails.countryOfResidence': 'Country of residence',
    }

    const data =
      krsScore?.components?.map((c) => [
        displayNames[c.parameter],
        c.value,
        c.score.toFixed(0),
        c.riskLevel,
      ]) || []
    data.push([
      'KYC risk score (KRS)',
      '-',
      krsScore?.krsScore,
      krsScore?.riskLevel,
    ])
    return {
      data,
      summary: ``,
    }
  },
  headers: [
    {
      name: 'Risk factor',
      columnType: 'STRING',
    },
    {
      name: 'Value',
      columnType: 'STRING',
    },
    {
      name: 'Risk score',
      columnType: 'NUMBER',
    },
    {
      name: 'Risk level',
      columnType: 'TAG',
    },
  ],
  variableOptions: {
    userId: {
      type: 'SEARCH',
      search: searchUser,
    },
  },
  defaults: ({ userId }) => {
    return { userId }
  },
}
