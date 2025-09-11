import { v4 as uuid4 } from 'uuid'
import cloneDeep from 'lodash/cloneDeep'
import memoize from 'lodash/memoize'
import { RuleQueue } from '@/@types/openapi-internal/RuleQueue'
import { hasFeature } from '@/core/utils/context'

const ruleQueueInstance = (): RuleQueue[] => {
  const highVelocityAlertQueue: RuleQueue = {
    id: uuid4(),
    name: 'High velocity alert',
    description: 'A queue for handling high velocity alerts',
    createdAt: Date.now(),
  }
  const sanctionQueue: RuleQueue = {
    id: uuid4(),
    name: 'Sanctions',
    description: 'A queue for handling sanctions',
    createdAt: Date.now(),
  }
  const deviationAlertQueue: RuleQueue = {
    id: uuid4(),
    name: 'Deviation alert',
    description: 'A queue for handling high deviation alerts',
    createdAt: Date.now(),
  }
  const pofQueue: RuleQueue = {
    id: uuid4(),
    name: 'Proof of funds alerts',
    description: 'A queue for handling proof of funds alerts',
    createdAt: Date.now(),
  }
  const chainalysisQueue: RuleQueue = {
    id: uuid4(),
    name: 'Chainalysis',
    description: 'A queue for handling Chainalysis alerts',
    createdAt: Date.now(),
  }
  const queues = [
    highVelocityAlertQueue,
    sanctionQueue,
    deviationAlertQueue,
    pofQueue,
  ]
  return hasFeature('CHAINALYSIS') ? [...queues, chainalysisQueue] : queues
}

export const getRandomRuleQueues = memoize(() => {
  return cloneDeep(ruleQueueInstance())
})
