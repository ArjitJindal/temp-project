import { ExecutedRulesResult } from '../openapi-internal/ExecutedRulesResult'
import { HitRulesDetails } from '../openapi-internal/HitRulesDetails'

export type Executions = {
  hitRules: HitRulesDetails[]
  executedRules: ExecutedRulesResult[]
}
