import { TransactionsStandardDeviationAnomalyBaseRule } from './transactions-standard-deviation-anomaly-base'
import { traceable } from '@/core/xray'

@traceable
export default class AverageTransactionValueSpikeRule extends TransactionsStandardDeviationAnomalyBaseRule {
  protected getMetricType() {
    return 'AVG_AMOUNT' as const
  }
}
