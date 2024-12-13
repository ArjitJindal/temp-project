import { v4 as uuid4 } from 'uuid'
import { cloneDeep } from 'lodash'
import { RuleQueue } from '@/@types/openapi-internal/RuleQueue'

const ruleQueueInstance: () => RuleQueue[] = () => {
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
  return [highVelocityAlertQueue, sanctionQueue, deviationAlertQueue, pofQueue]
}

export function getRandomRuleQueues() {
  return cloneDeep(ruleQueueInstance())
}
