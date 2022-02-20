import MultipleSendersWithinTimePeriodRuleBase, {
  SenderReceiverTypes,
} from './multiple-senders-within-time-period-base'
import { RuleInfo } from './rule'

export default class MultipleCounterpartySendersWithinTimePeriodRule extends MultipleSendersWithinTimePeriodRuleBase {
  public getInfo(): RuleInfo {
    return {
      name: 'multiple_counterparty_senders_within_time_period',
      displayName:
        'More than x counterparties transacting with one customer over a set period of time t',
      description:
        'More than x counterparties transacting with a single user over a set period of time t (E.g. Nigerian prince scam inbound)',
    }
  }

  getSenderReceiverTypes(): SenderReceiverTypes {
    return {
      senderTypes: ['USER'],
      receiverTypes: ['USER', 'NON_USER'],
    }
  }
}
