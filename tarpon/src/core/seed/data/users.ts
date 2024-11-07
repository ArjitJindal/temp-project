import { memoize, compact, uniq } from 'lodash'
import {
  sampleBusinessUser,
  sampleConsumerUser,
} from '@/core/seed/samplers/users'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { companies } from '@/core/seed/samplers/dictionary'

const businessUsers: () => InternalBusinessUser[] = memoize(() => {
  return companies.map((c) => sampleBusinessUser({ company: c }).user)
})

const consumerUsers: () => InternalConsumerUser[] = memoize(() => {
  return [...new Array(200)].map(() => sampleConsumerUser())
})

export const getUsers: () => (InternalBusinessUser | InternalConsumerUser)[] =
  memoize(() => [...businessUsers(), ...consumerUsers()])

export const getUserUniqueTags = memoize(() => {
  const users = getUsers()
  return compact(uniq(users.flatMap((u) => u.tags?.map((t) => t.key))))
})
