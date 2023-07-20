import { uuid4 } from '@sentry/utils'
import { sampleConsumerUserRiskScoreComponents } from '../samplers/risk_score_components'
import {
  merchantMonitoringSummaries,
  sampleBusinessUser,
  sampleKycStatusDetails,
  sampleUserStateDetails,
} from '@/core/seed/samplers/users'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { pickRandom, randomFloat } from '@/utils/prng'
import { companies, randomName } from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'

const data: (InternalBusinessUser | InternalConsumerUser)[] = []
const merchantMonitoring: MerchantMonitoringSummary[] = []
const drsData: DrsScore[] = []
const krsData: KrsScore[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  const businessUserData = companies.map(
    (
      c,
      i
    ): {
      user: InternalBusinessUser
      merchantMonitoring: MerchantMonitoringSummary[]
    } => {
      const { user, drsScore, krsScore } = sampleBusinessUser({ company: c }, i)
      drsData.push(drsScore)
      krsData.push(krsScore)
      return {
        user,
        merchantMonitoring: merchantMonitoringSummaries(user.userId, c),
      }
    }
  )

  merchantMonitoring.push(
    ...businessUserData.flatMap((b) => b.merchantMonitoring)
  )

  data.push(
    ...[
      ...businessUserData.map((b) => b.user),
      ...[...new Array(30)].map((_, i): InternalConsumerUser => {
        const userId = uuid4()
        const drsScore = Number((randomFloat(i * 2) * 100).toFixed(2))
        const krsScore = Number((randomFloat(i * 2) * 100).toFixed(2))
        drsData.push({
          createdAt: sampleTimestamp(i),
          userId: userId,
          derivedRiskLevel: pickRandom(RISK_LEVEL1S),
          drsScore: drsScore,
          isUpdatable: true,
        })
        krsData.push({
          createdAt: sampleTimestamp(i),
          krsScore: krsScore,
          userId: userId,
          riskLevel: pickRandom(RISK_LEVEL1S),
          components: sampleConsumerUserRiskScoreComponents(),
        })
        return {
          type: 'CONSUMER' as const,
          userId,
          drsScore: {
            drsScore: drsScore,
            createdAt: Date.now(),
            isUpdatable: true,
          },
          krsScore: {
            krsScore: krsScore,
            createdAt: Date.now(),
          },
          riskLevel: pickRandom(RISK_LEVEL1S, i),
          userStateDetails: sampleUserStateDetails(0.9 * i),
          kycStatusDetails: sampleKycStatusDetails(0.9 * i),
          userDetails: {
            dateOfBirth: new Date(sampleTimestamp(i * 0.1)).toISOString(),
            countryOfResidence: pickRandom(COUNTRY_CODES, i * 0.1),
            countryOfNationality: pickRandom(COUNTRY_CODES, i * 0.1),
            name: {
              firstName: randomName(),
              middleName: randomName(),
              lastName: randomName(),
            },
          },
          createdTimestamp: sampleTimestamp(0.9 * i),
        }
      }),
    ]
  )
}

export { init, data, merchantMonitoring, drsData, krsData }
