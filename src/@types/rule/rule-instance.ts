export enum RuleActionEnum {
  ALLOW = 'ALLOW',
  FLAG = 'FLAG',
  BLOCK = 'BLOCK',
}
export type RuleParameters = {
  action: RuleActionEnum
}

export type RuleInstance<P = RuleParameters> = {
  id?: string
  ruleId: string
  parameters: P
  status?: RuleInstanceStatus
  createdAt?: number
  updatedAt?: number
  runCount?: number
  hitCount?: number
}

export type RuleInstanceStatus = 'ACTIVE' | 'INACTIVE'
