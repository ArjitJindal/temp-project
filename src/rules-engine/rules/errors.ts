export class NoData extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NoData'
  }
}

export class MissingRuleParameter extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingRuleParameter'
  }
}
