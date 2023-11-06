import { FalsePositiveDetails } from '@/@types/openapi-internal/FalsePositiveDetails'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { CaseSubjectType } from '@/@types/openapi-internal/CaseSubjectType'
import { RuleHitDirection } from '@/@types/openapi-internal/RuleHitDirection'
import { traceable } from '@/core/xray'
import { Vars } from '@/services/rules-engine/utils/format-description'

export type RuleHitResultItem = {
  direction: RuleHitDirection
  vars: Vars
  falsePositiveDetails?: FalsePositiveDetails
  subjectType?: CaseSubjectType
  sanctionsDetails?: SanctionsDetails[]
  // todo: remove after refactoring, it breaks the rule results abstraction
  caseCreationParams?: {
    subjectType?: CaseSubjectType
    createFor?: CaseSubjectType
  }
}
export type RuleHitResult = Array<RuleHitResultItem | undefined>

export type RuleFilter = () => Promise<boolean> | boolean

@traceable
export abstract class Rule {
  public static getSchema(): object {
    throw new Error('Not implemented')
  }

  public abstract computeRule(): Promise<RuleHitResult | undefined>
}
