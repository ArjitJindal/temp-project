import MultipleSendersWithinTimePeriodRuleBase, {
  SenderReceiverTypes,
} from './multiple-senders-within-time-period-base'
import { RuleInfo } from './rule'

export default class MultipleUserSendersWithinTimePeriodRule extends MultipleSendersWithinTimePeriodRuleBase {
  public getInfo(): RuleInfo {
    return {
      name: 'multiple_user_senders_within_time_period',
      displayName:
        'More than x customers transacting with a single counterparty over a set period of time t',
      description:
        'More than x users transacting with a single counterparty over a set period of time t (E.g. Nigerian prince scam outbound)',
    }
  }

  getSenderReceiverTypes(): SenderReceiverTypes {
    return {
      senderTypes: ['USER'],
      receiverTypes: ['USER', 'NON_USER'],
    }
  }
}
