import { memoize, compact, uniq } from 'lodash'
import {
  merchantMonitoringSummaries,
  sampleBusinessUser,
  sampleConsumerUser,
} from '@/core/seed/samplers/users'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { companies } from '@/core/seed/samplers/dictionary'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'

const businessUsers: () => InternalBusinessUser[] = memoize(() => {
  return companies.map((c) => sampleBusinessUser({ company: c }).user)
})

const consumerUsers: () => InternalConsumerUser[] = memoize(() => {
  return [...new Array(200)].map(() => sampleConsumerUser())
})

export const getMerchantMonitoring: () => MerchantMonitoringSummary[] = memoize(
  () => {
    return businessUsers().flatMap((b) =>
      merchantMonitoringSummaries(
        b.userId,
        companies.find(
          (c) => c.name === b.legalEntity.companyGeneralDetails.legalName
        ) ?? companies[0]
      )
    )
  }
)

export const getUsers: () => (InternalBusinessUser | InternalConsumerUser)[] =
  memoize(() => [...businessUsers(), ...consumerUsers()])

export const getUserUniqueTags = memoize(() => {
  const users = getUsers()
  return compact(uniq(users.flatMap((u) => u.tags?.map((t) => t.key))))
})
