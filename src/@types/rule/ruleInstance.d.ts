export type RuleInstance<RuleParameters = { [key: string]: any }> = {
  id?: string
  ruleId: string
  parameters: RuleParameters
  status?: RuleInstanceStatus
  createdAt?: number
  updatedAt?: number
  runCount?: number
  hitCount?: number
}

export type RuleInstanceStatus = 'ACTIVE' | 'INACTIVE'
