import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import { TableQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { KRS_SCORES_COLLECTION } from '@/utils/mongodb-definitions'
import { searchUser } from '@/services/copilot/questions/definitions/common/search'
import { queryUsername } from '@/services/copilot/questions/definitions/util'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'

export const KycScoring: TableQuestion<{
  userId: string
  sortField?: string
  sortOrder?: string
}> = {
  type: 'TABLE',
  questionId: COPILOT_QUESTIONS.KYC_SCORING,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async ({ userId }) => {
    return `KYC risk score (KRS) for ${await queryUsername(userId)}`
  },
  aggregationPipeline: async (
    { tenantId },
    { userId, sortField, sortOrder }
  ) => {
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

    const items =
      krsScore?.components?.map((c) => [
        displayNames[c.parameter],
        c.value,
        c.score.toFixed(0),
        c.value,
      ]) || []
    items.push([
      'KYC risk score (KRS)',
      '-',
      krsScore?.krsScore,
      krsScore?.riskLevel,
    ])

    if (sortField && sortOrder) {
      const columnIndex = sortField === 'krsScore' ? 2 : 0

      items.sort((a, b) => {
        const aVal = a[columnIndex]
        const bVal = b[columnIndex]
        const comparison = String(aVal).localeCompare(String(bVal), 'en', {
          numeric: true,
        })
        return sortOrder === 'descend' ? -comparison : comparison
      })
    }

    return {
      data: { items },
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
      columnType: 'FLOAT',
      columnId: 'krsScore',
      sortable: true,
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
