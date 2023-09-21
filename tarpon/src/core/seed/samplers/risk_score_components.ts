import { transactions } from '../data/transactions'
import { sampleTimestamp } from './timestamp'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskLevelFromScore } from '@/services/risk-scoring/utils'
import { randomFloat } from '@/utils/prng'

export function sampleConsumerUserRiskScoreComponents(
  consumer: InternalConsumerUser
): RiskScoreComponent[] {
  const scores = [...new Array(4)].map(() =>
    Number((randomFloat() * 100).toFixed(2))
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
    Number((randomFloat() * 100).toFixed(2))
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
  transaction: InternalTransaction
): RiskScoreComponent[] => {
  const scores = [...new Array(4)].map(() =>
    Number((randomFloat() * 100).toFixed(2))
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
      value: transaction?.type,
    },
    {
      score: scores[1],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[1]
      ),
      entityType: 'TRANSACTION',
      parameter: 'originAmountDetails.transactionCurrency',
      value: transaction?.originAmountDetails?.transactionCurrency,
    },
    {
      score: scores[2],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[2]
      ),
      entityType: 'TRANSACTION',
      parameter: 'originPaymentDetails.method',
      value: transaction?.originPaymentDetails?.method,
    },
    {
      score: scores[3],
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        scores[3]
      ),
      entityType: 'TRANSACTION',
      parameter: 'destinationAmountDetails.country',
      value: transaction?.destinationAmountDetails?.country,
    },
  ]
}

export const getDrsAndKrsScoreDetials = (
  krsScoreComponents: RiskScoreComponent[],
  userId: string
): { krsScore: KrsScore; drsScore: DrsScore } => {
  const krsScore =
    krsScoreComponents.reduce((acc, curr) => acc + curr.score, 0) /
    krsScoreComponents.length

  const krsUserData = {
    createdAt: sampleTimestamp(),
    krsScore: krsScore,
    userId: userId,
    riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, krsScore),
    components: krsScoreComponents,
  } as KrsScore

  const userTransactions = transactions.find(
    (t) => t.originUserId === userId || t.destinationUserId === userId
  )
  const drsScoreComponents: RiskScoreComponent[] = []

  drsScoreComponents.push(...krsScoreComponents)

  if (userTransactions) {
    const transactionRiskScoreComponents =
      userTransactions.arsScore?.components ?? []

    drsScoreComponents.push(...transactionRiskScoreComponents)
  }

  const drsScore =
    drsScoreComponents.reduce((acc, curr) => acc + curr.score, 0) /
    drsScoreComponents.length

  const drsUserData = {
    createdAt: sampleTimestamp(),
    userId: userId,
    derivedRiskLevel: getRiskLevelFromScore(
      DEFAULT_CLASSIFICATION_SETTINGS,
      drsScore
    ),
    drsScore: drsScore,
    isUpdatable: true,
    components: drsScoreComponents,
  } as DrsScore

  return { krsScore: krsUserData, drsScore: drsUserData }
}
