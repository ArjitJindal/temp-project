import MultipleSendersWithinTimePeriodRuleBase, {
  SenderReceiverTypes,
} from './multiple-senders-within-time-period-base'
import { traceable } from '@/core/xray'

@traceable
export default class MultipleUserSendersWithinTimePeriodRule extends MultipleSendersWithinTimePeriodRuleBase {
  getSenderReceiverTypes(): SenderReceiverTypes {
    return {
      senderTypes: ['USER'],
      receiverTypes: ['USER', 'NON_USER'],
    }
  }
}
