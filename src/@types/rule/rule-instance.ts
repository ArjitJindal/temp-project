export enum RuleActionEnum {
  ALLOW = 'ALLOW',
  FLAG = 'FLAG',
  BLOCK = 'BLOCK',
}
export type RuleParameters = {
  action: RuleActionEnum
}
