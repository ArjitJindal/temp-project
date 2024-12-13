import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { SAMPLE_CURRENCIES } from './currencies'
import { COUNTRIES } from './countries'
import { BaseSampler } from './base'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'

export class ConsumerUserRiskScoreSampler extends BaseSampler<
  RiskScoreComponent[]
> {
  generateSample(consumer?: InternalConsumerUser): RiskScoreComponent[] {
    // generate 4 random scores
    const scores = [...new Array(4)].map((_, i) =>
      this.rng.r(i + 1).randomFloat()
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
        weight: 1,
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
        weight: 1,
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
        weight: 1,
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
        weight: 1,
      },
    ]
  }
}

export class BusinessUserRiskScoreSampler extends BaseSampler<
  RiskScoreComponent[]
> {
  generateSample(business?: InternalBusinessUser): RiskScoreComponent[] {
    // generate 4 random scores
    const scores = [...new Array(4)].map((_, i) =>
      this.rng.r(i + 1).randomFloat()
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
        weight: 1,
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
        weight: 1,
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
          business?.legalEntity?.companyRegistrationDetails
            ?.registrationCountry,
        weight: 1,
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
        weight: 1,
      },
    ]
  }
}

export class TransactionRiskScoreSampler extends BaseSampler<
  RiskScoreComponent[]
> {
  generateSample(transaction?: InternalTransaction): RiskScoreComponent[] {
    // generate 4 random scores
    const scores = [...new Array(4)].map((_, i) =>
      this.rng.r(i + 1).randomFloat()
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
        value: transaction?.type ?? this.rng.r(5).pickRandom(TRANSACTION_TYPES),
        weight: 1,
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
          this.rng.r(6).pickRandom(SAMPLE_CURRENCIES),
        weight: 1,
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
          this.rng.r(7).pickRandom(PAYMENT_METHODS),
        weight: 1,
      },
      {
        score: scores[3],
        riskLevel: getRiskLevelFromScore(
          DEFAULT_CLASSIFICATION_SETTINGS,
          scores[3]
        ),
        entityType: 'TRANSACTION',
        parameter: 'destinationAmountDetails.country',
        value:
          transaction?.destinationAmountDetails?.country ??
          this.rng.r(8).pickRandom(COUNTRIES),
        weight: 1,
      },
    ]
  }
}
