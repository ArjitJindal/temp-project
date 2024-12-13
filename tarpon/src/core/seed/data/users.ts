import { memoize, compact, uniq } from 'lodash'
import {
  BusinessUserSampler,
  ConsumerUserSampler,
} from '@/core/seed/samplers/users'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { companies } from '@/core/seed/samplers/dictionary'
import { USERS_SEED } from '@/core/seed/data/seeds'

const businessUsers: () => InternalBusinessUser[] = memoize(() => {
  const sampler = new BusinessUserSampler(USERS_SEED)
  return companies.map((c) => sampler.getSample(undefined, c))
})

const consumerUsers: () => InternalConsumerUser[] = memoize(() => {
  // start counter after the last business user to prevent user id overlap
  const startCounter = companies.length
  const sampler = new ConsumerUserSampler(USERS_SEED + 1, startCounter)
  return [...new Array(200)].map(() => sampler.getSample())
})

export const getUsers: () => (InternalBusinessUser | InternalConsumerUser)[] =
  memoize(() => [...businessUsers(), ...consumerUsers()])

export const getUserUniqueTags = memoize(() => {
  const users = getUsers()
  return compact(uniq(users.flatMap((u) => u.tags?.map((t) => t.key))))
})
