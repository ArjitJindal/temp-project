import { TransactionsStandardDeviationAnomalyBaseRule } from './transactions-standard-deviation-anomaly-base'
import { traceable } from '@/core/xray'

@traceable
export default class RoundAmountAnomalyRule extends TransactionsStandardDeviationAnomalyBaseRule {
  protected getMetricType() {
    return 'ROUND_PERCENT' as const
  }
}
