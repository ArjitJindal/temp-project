import { v4 as uuid4 } from 'uuid'
import { sampleTag } from '../samplers/tag'
import { randomUserRules, userRules } from './rules'
import {
  merchantMonitoringSummaries,
  randomPhoneNumber,
  sampleBusinessUser,
  sampleKycStatusDetails,
  sampleUserStateDetails,
} from '@/core/seed/samplers/users'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { pickRandom } from '@/utils/prng'
import { companies, randomName } from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { randomAddress } from '@/core/seed/samplers/address'
import { ACQUISITION_CHANNELS } from '@/@types/openapi-internal-custom/AcquisitionChannel'
import { CONSUMER_USER_SEGMENTS } from '@/@types/openapi-internal-custom/ConsumerUserSegment'

const data: (InternalBusinessUser | InternalConsumerUser)[] = []
const merchantMonitoring: MerchantMonitoringSummary[] = []

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
      const { user } = sampleBusinessUser({ company: c }, i)

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

        const user: InternalConsumerUser = {
          type: 'CONSUMER' as const,
          userId,
          riskLevel: pickRandom(RISK_LEVEL1S, i),
          acquisitionChannel: pickRandom(ACQUISITION_CHANNELS),
          userSegment: pickRandom(CONSUMER_USER_SEGMENTS),
          reasonForAccountOpening: [
            pickRandom(['Investment', 'Saving', 'Business', 'Other']),
          ],
          userStateDetails: sampleUserStateDetails(0.9 * i),
          contactDetails: {
            addresses: [randomAddress()],
            contactNumbers: [randomPhoneNumber()],
          },
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
          executedRules: userRules,
          hitRules: randomUserRules().filter(
            (r) => !r.ruleName.toLowerCase().includes('business')
          ),
          createdTimestamp: sampleTimestamp(0.9 * i),
          tags: [sampleTag()],
        }

        return user
      }),
    ]
  )
}

export { init, data, merchantMonitoring }
