import {
  merchantMonitoringSummaries,
  sampleBusinessUser,
  sampleConsumerUser,
} from '@/core/seed/samplers/users'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { companies } from '@/core/seed/samplers/dictionary'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'

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
      ...[...new Array(30)].map(() => sampleConsumerUser()),
    ]
  )
}

export { init, data, merchantMonitoring }
