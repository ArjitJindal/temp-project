import MultipleSendersWithinTimePeriodRuleBase, {
  SenderReceiverTypes,
} from './multiple-senders-within-time-period-base'
import { traceable } from '@/core/xray'

@traceable
export default class MultipleCounterpartySendersWithinTimePeriodRule extends MultipleSendersWithinTimePeriodRuleBase {
  getSenderReceiverTypes(): SenderReceiverTypes {
    return {
      senderTypes: ['NON_USER'],
      receiverTypes: ['USER', 'NON_USER'],
    }
  }
}
