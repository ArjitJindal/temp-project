import { COPILOT_QUESTIONS } from '@flagright/lib/utils'
import pluralize from 'pluralize'
import { PropertiesQuestion } from '@/services/copilot/questions/types'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { getUserName } from '@/utils/helpers'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { ContactDetails } from '@/@types/openapi-internal/ContactDetails'
import { searchUser } from '@/services/copilot/questions/definitions/common/search'

export const UserDetails: PropertiesQuestion<{ userId: string }> = {
  type: 'PROPERTIES',
  questionId: COPILOT_QUESTIONS.USER_DETAILS,
  categories: ['CONSUMER', 'BUSINESS'],
  title: async (_, { userId }) => {
    return `User details for ${userId}`
  },
  aggregationPipeline: async ({ tenantId }, { userId }) => {
    const client = await getMongoDbClient()
    const db = client.db()
    const result = await db
      .collection<InternalConsumerUser | InternalBusinessUser>(
        USERS_COLLECTION(tenantId)
      )
      .findOne({ userId })

    return {
      data: [
        { key: 'User ID', value: result?.userId || '' },
        { key: 'User name', value: getUserName(result) },
        { key: 'Type', value: result?.type },
        { key: 'State', value: result?.userStateDetails?.state },
        { key: 'Acquisition Channel', value: result?.acquisitionChannel },
        ...(result?.type === 'CONSUMER'
          ? [
              {
                key: 'Country of residence',
                value: result?.userDetails?.countryOfResidence,
              },
              {
                key: 'Date of birth',
                value: result?.userDetails?.dateOfBirth,
              },
              {
                key: 'Nationality',
                value: result?.userDetails?.countryOfNationality,
              },
              {
                key: 'Occupation',
                value: result.occupation,
              },
              {
                key: 'Employment status',
                value: result.employmentStatus,
              },
              {
                key: 'KYC status',
                value: result.kycStatusDetails?.status,
              },
              {
                key: 'Legal documents',
                value: result?.legalDocuments
                  ?.map((doc) => doc.documentType)
                  .join(', '),
              },
              ...contactDetails(result),
            ]
          : []),
        ...(result?.type === 'BUSINESS'
          ? [
              {
                key: 'Registration country',
                value:
                  result?.legalEntity.companyRegistrationDetails
                    ?.registrationCountry,
              },
              {
                key: 'Legal entity type',
                value:
                  result?.legalEntity.companyRegistrationDetails
                    ?.legalEntityType,
              },
              {
                key: 'Date of registration',
                value:
                  result?.legalEntity.companyRegistrationDetails
                    ?.dateOfRegistration,
              },
              {
                key: 'Registration identifier',
                value:
                  result?.legalEntity.companyRegistrationDetails
                    ?.registrationIdentifier,
              },
              {
                key: 'Tax identifier',
                value:
                  result?.legalEntity.companyRegistrationDetails?.taxIdentifier,
              },
              ...contactDetails(result.legalEntity),
              {
                key: 'User segment',
                value: result.legalEntity.companyGeneralDetails.userSegment,
              },
              {
                key: 'Products sold',
                value:
                  result.legalEntity.companyGeneralDetails.mainProductsServicesSold?.join(
                    ', '
                  ),
              },
              {
                key: 'Registration status',
                value:
                  result.legalEntity.companyGeneralDetails
                    .userRegistrationStatus,
              },
              {
                key: 'Industry',
                value:
                  result.legalEntity.companyGeneralDetails.businessIndustry?.join(
                    ', '
                  ),
              },
              {
                key: 'Expected turnover per month',
                value:
                  result.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth?.amountValue.toFixed(
                    0
                  ),
              },
              {
                key: 'Expected transaction amount per month',
                value:
                  result.legalEntity.companyFinancialDetails?.expectedTransactionAmountPerMonth?.amountValue.toFixed(
                    0
                  ),
              },
            ]
          : []),
        {
          key: 'KRS Score',
          value: result?.krsScore?.krsScore.toFixed(0),
        },
        {
          key: 'CRA Score',
          value: result?.drsScore?.drsScore.toFixed(0),
        },
        {
          key: 'Risk level',
          value: result?.riskLevel ?? result?.drsScore?.derivedRiskLevel,
        },
        {
          key: 'Manual risk level',
          value: result?.drsScore?.manualRiskLevel,
        },
        {
          key: 'Created at',
          value: new Date(result?.createdTimestamp || 0).toISOString(),
        },
        {
          key: 'Updated at',
          value: new Date(result?.updatedAt || 0).toISOString(),
        },
      ],
      summary: ``,
    }
  },
  variableOptions: {
    userId: {
      type: 'SEARCH',
      search: searchUser,
    },
  },
  defaults: ({ userId }) => {
    return {
      userId: userId || '',
    }
  },
}

function contactDetails(result: {
  contactDetails?: ContactDetails
}): { key: string; value: string | undefined }[] {
  const addressesCount = result.contactDetails?.addresses?.length || 0
  return [
    {
      key: 'Emails',
      value: result?.contactDetails?.emailIds?.join(', '),
    },
    {
      key: 'Phone numbers',
      value: result?.contactDetails?.contactNumbers?.join(', '),
    },
    {
      key: 'Websites',
      value: result?.contactDetails?.websites?.join(', '),
    },
    ...(result.contactDetails?.addresses?.map((a, i) => {
      const addressIndex = i + 1
      const showAddressIndex = addressesCount > 1
      const address = [
        a.addressLines.join(', '),
        a.city,
        a.postcode,
        a.country,
      ].join(', ')
      return {
        key: i === 0 ? pluralize('Address', addressesCount) : '',
        value: `${showAddressIndex ? `${addressIndex}).` : ''} ${address}`,
      }
    }) || []),
  ]
}
