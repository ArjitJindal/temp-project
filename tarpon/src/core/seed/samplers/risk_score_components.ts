import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { RiskScoreComponent } from '@/@types/openapi-internal/RiskScoreComponent'
import { pickRandom, randomFloat } from '@/utils/prng'

export function sampleConsumerUserRiskScoreComponents(): RiskScoreComponent[] {
  return [
    {
      score: Number((randomFloat() * 100).toFixed(2)),
      riskLevel: pickRandom(RISK_LEVEL1S),
      entityType: 'CONSUMER_USER',
      parameter: 'type',
      value: 'CONSUMER',
    },
    {
      score: Number((randomFloat() * 100).toFixed(2)),
      riskLevel: pickRandom(RISK_LEVEL1S),
      entityType: 'CONSUMER_USER',
      parameter: 'userDetails.countryOfNationality',
      value: 'DE',
    },
    {
      score: Number((randomFloat() * 100).toFixed(2)),
      riskLevel: pickRandom(RISK_LEVEL1S),
      entityType: 'CONSUMER_USER',
      parameter: 'userDetails.dateOfBirth',
      value: '28',
    },
    {
      score: Number((randomFloat() * 100).toFixed(2)),
      riskLevel: pickRandom(RISK_LEVEL1S),
      entityType: 'CONSUMER_USER',
      parameter: 'userDetails.countryOfResidence',
      value: 'DK',
    },
  ]
}

export function sampleBusinessUserRiskScoreComponents(): RiskScoreComponent[] {
  return [
    {
      score: Number((randomFloat() * 100).toFixed(2)),
      riskLevel: pickRandom(RISK_LEVEL1S),
      entityType: 'BUSINESS',
      parameter: 'type',
      value: 'BUSINESS',
    },
    {
      score: Number((randomFloat() * 100).toFixed(2)),
      riskLevel: pickRandom(RISK_LEVEL1S),
      entityType: 'BUSINESS',
      parameter: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
      value: ['REGISTERED'],
    },
    {
      score: Number((randomFloat() * 100).toFixed(2)),
      riskLevel: pickRandom(RISK_LEVEL1S),
      entityType: 'BUSINESS',
      parameter: 'legalEntity.companyRegistrationDetails.registrationCountry',
      value: 'JP',
    },
    {
      score: Number((randomFloat() * 100).toFixed(2)),
      riskLevel: pickRandom(RISK_LEVEL1S),
      entityType: 'BUSINESS',
      parameter: 'legalEntity.companyGeneralDetails.userSegment',
      value: 'MEDIUM',
    },
  ]
}
