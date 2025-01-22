import { memoize } from 'lodash'
import {
  BusinessUserEventSampler,
  ConsumerUserEventSampler,
} from '../samplers/user_events'
import { users } from './users'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import { InternalBusinessUserEvent } from '@/@types/openapi-internal/InternalBusinessUserEvent'
import { InternalConsumerUserEvent } from '@/@types/openapi-internal/InternalConsumerUserEvent'
import { logger } from '@/core/logger'

export const getUserEvents = memoize(() => {
  logger.info('Generating user events...')
  const businessUserEventSampler = new BusinessUserEventSampler()
  const consumerUserEventSampler = new ConsumerUserEventSampler()
  const businessUserEvents: InternalBusinessUserEvent[] = []
  const consumerUserEvents: InternalConsumerUserEvent[] = []
  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    if (isBusinessUser(user)) {
      businessUserEvents.push(...businessUserEventSampler.generateSample(user))
    } else {
      consumerUserEvents.push(...consumerUserEventSampler.generateSample(user))
    }
  }
  return [...businessUserEvents, ...consumerUserEvents]
})
