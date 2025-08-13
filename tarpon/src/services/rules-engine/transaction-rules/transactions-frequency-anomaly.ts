import { TransactionsStandardDeviationAnomalyBaseRule } from './transactions-standard-deviation-anomaly-base'
import { traceable } from '@/core/xray'

@traceable
export default class TransactionsFrequencyAnomalyRule extends TransactionsStandardDeviationAnomalyBaseRule {
  protected getMetricType() {
    return 'COUNT' as const
  }
}
