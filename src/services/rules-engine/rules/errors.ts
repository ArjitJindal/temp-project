export class RuleError extends Error {}

export class NoData extends RuleError {
  constructor(message: string) {
    super(message)
    this.name = 'NO_DATA'
  }
}

export class MissingRuleParameter extends RuleError {
  constructor(message = 'Missing required rule parameters') {
    super(message)
    this.name = 'MISSING_RULE_PARAMETER'
  }
}
