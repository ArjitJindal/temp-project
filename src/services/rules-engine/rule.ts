import { RuleAction } from '@/@types/openapi-public/RuleAction'

export type RuleResult = {
  action: RuleAction
}

export type RuleFilter = () => Promise<boolean> | boolean

export abstract class Rule {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  /**
   * TODO: For now, the filtered are hard-coded in each rule. We could
   * have a 'filters' library and users can apply arbitrary filters to
   * a rule.
   */
  public getFilters(): RuleFilter[] {
    return []
  }

  public async computeRule(): Promise<RuleResult | undefined> {
    throw new Error('Not implemented')
  }
}
