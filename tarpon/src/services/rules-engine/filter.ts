export abstract class RuleFilter {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  public static getDefaultValues?(): object {
    return {}
  }

  public abstract predicate(): Promise<boolean>
}
