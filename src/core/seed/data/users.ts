import { uuid4 } from '@sentry/utils'
import {
  sampleBusinessUser,
  sampleKycStatusDetails,
  sampleUserStateDetails,
} from '@/core/seed/samplers/users'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { pickRandom, randomFloat } from '@/utils/prng'
import { companies, randomName } from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'

const data: (Business | User)[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  data.push(
    ...[
      ...companies.map(
        (c, i): InternalBusinessUser => sampleBusinessUser({ legalName: c }, i)
      ),
      ...[...new Array(30)].map(
        (_, i): InternalConsumerUser => ({
          type: 'CONSUMER' as const,
          userId: uuid4(),
          drsScore: {
            drsScore: randomFloat(i, 1),
            createdAt: Date.now(),
            isUpdatable: true,
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
        })
      ),
    ]
  )
}

export { init, data }
