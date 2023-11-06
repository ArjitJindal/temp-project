import { TransactionRule } from '../rule'
import { RuleHitResult } from '../../rule'
import { RuleHitDirection } from '@/@types/openapi-public/RuleHitDirection'
import { CaseSubjectType } from '@/@types/openapi-public/CaseSubjectType'

export default class TestAlwaysHitRule extends TransactionRule<{
  hitDirections?: RuleHitDirection[]
  caseSubjectType?: CaseSubjectType
}> {
  public async computeRule() {
    return (this.parameters.hitDirections || ['ORIGIN', 'DESTINATION']).map(
      (direction) => ({
        direction,
        subjectType: this.parameters.caseSubjectType ?? 'USER',
        vars: {},
        caseCreationParams: {
          subjectType: this.parameters.caseSubjectType ?? 'USER',
        },
      })
    ) as RuleHitResult
  }
}
