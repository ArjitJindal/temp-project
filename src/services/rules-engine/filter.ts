export abstract class RuleFilter {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  public async predicate(): Promise<boolean> {
    throw new Error('Not implemented')
  }
}
