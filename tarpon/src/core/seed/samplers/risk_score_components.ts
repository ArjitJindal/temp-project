import { sampleCurrency } from './currencies'
import { sampleCountry } from './countries'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskLevelFromScore } from '@/services/risk-scoring/utils'
import { pickRandom, randomFloat } from '@/core/seed/samplers/prng'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'

export function sampleConsumerUserRiskScoreComponents(
  consumer: InternalConsumerUser
): RiskScoreComponent[] {
  const scores = [...new Array(4)].map(() =>
    Number(randomFloat(100).toFixed(2))
  )

  return [
    {
      score: scores[0],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[0]
      ),
      entityType: 'CONSUMER_USER',
      parameter: 'type',
      value: 'CONSUMER',
    },
    {
      score: scores[1],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[1]
      ),
      entityType: 'CONSUMER_USER',
      parameter: 'userDetails.countryOfNationality',
      value: consumer?.userDetails?.countryOfNationality,
    },
    {
      score: scores[2],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[2]
      ),
      entityType: 'CONSUMER_USER',
      parameter: 'userDetails.dateOfBirth',
      value: consumer?.userDetails?.dateOfBirth,
    },
    {
      score: scores[3],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[3]
      ),
      entityType: 'CONSUMER_USER',
      parameter: 'userDetails.countryOfResidence',
      value: consumer?.userDetails?.countryOfResidence,
    },
  ]
}

export function sampleBusinessUserRiskScoreComponents(
  business: InternalBusinessUser
): RiskScoreComponent[] {
  const scores = [...new Array(4)].map(() =>
    Number(randomFloat(100).toFixed(2))
  )
  return [
    {
      score: scores[0],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[0]
      ),
      entityType: 'BUSINESS',
      parameter: 'type',
      value: 'BUSINESS',
    },
    {
      score: scores[1],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[1]
      ),
      entityType: 'BUSINESS',
      parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
      value:
        business?.legalEntity?.companyGeneralDetails?.userRegistrationStatus,
    },
    {
      score: scores[2],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[2]
      ),
      entityType: 'BUSINESS',
      parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
      value:
        business?.legalEntity?.companyRegistrationDetails?.registrationCountry,
    },
    {
      score: scores[3],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[3]
      ),
      entityType: 'BUSINESS',
      parameter: 'legalEntity.companyGeneralDetails.userSegment',
      value: business?.legalEntity?.companyGeneralDetails?.userSegment,
    },
  ]
}

export const sampleTransactionRiskScoreComponents = (
  transaction?: InternalTransaction
): RiskScoreComponent[] => {
  const scores = [...new Array(4)].map(() =>
    Number(randomFloat(100).toFixed(2))
  )

  return [
    {
      score: scores[0],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[0]
      ),
      entityType: 'TRANSACTION',
      parameter: 'type',
      value: transaction?.type ?? pickRandom(TRANSACTION_TYPES),
    },
    {
      score: scores[1],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[1]
      ),
      entityType: 'TRANSACTION',
      parameter: 'originAmountDetails.transactionCurrency',
      value:
        transaction?.originAmountDetails?.transactionCurrency ??
        sampleCurrency(),
    },
    {
      score: scores[2],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[2]
      ),
      entityType: 'TRANSACTION',
      parameter: 'originPaymentDetails.method',
      value:
        transaction?.originPaymentDetails?.method ??
        pickRandom(PAYMENT_METHODS),
    },
    {
      score: scores[3],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[3]
      ),
      entityType: 'TRANSACTION',
      parameter: 'destinationAmountDetails.country',
      value: transaction?.destinationAmountDetails?.country ?? sampleCountry(),
    },
  ]
}
