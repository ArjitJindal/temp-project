export type RuleComputeResult = {
  transactionId: string
  rules: ReadonlyArray<{
    ruleId: string
    ruleName: string
    ruleDescription: string
    ruleAction: string
    ruleHit: boolean
  }>
}
