import { TransactionsStandardDeviationAnomalyBaseRule } from './transactions-standard-deviation-anomaly-base'
import { traceable } from '@/core/xray'

@traceable
export default class TransactionAnomalyRule extends TransactionsStandardDeviationAnomalyBaseRule {
  protected getMetricType() {
    return 'AMOUNT' as const
  }

  protected getWindowDays() {
    return { periodDays: 7, baselineDays: 30 } as const
  }
}
