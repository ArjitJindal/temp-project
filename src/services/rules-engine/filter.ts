export abstract class RuleFilter {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  public abstract predicate(): Promise<boolean>
}
