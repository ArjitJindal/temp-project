import { JSONSchemaType } from 'ajv'
import {
  FUZZINESS_SCHEMA,
  RULE_STAGE_SCHEMA,
  GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import dayjs from '@/utils/dayjs'
import { User } from '@/@types/openapi-public/User'
import { RuleStage } from '@/@types/openapi-internal/RuleStage'
import { hasFeature } from '@/core/utils/context'

export type SanctionsConsumerUserRuleParameters = {
  screeningTypes?: SanctionsSearchType[]
  fuzziness: number
  ruleStages: RuleStage[]
}

export default class SanctionsConsumerUserRule extends UserRule<SanctionsConsumerUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsConsumerUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        screeningTypes: GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({
          uiSchema: {
            subtype: 'GENERIC_SANCTIONS_SCREENING_TYPES',
          },
        }),
        fuzziness: FUZZINESS_SCHEMA(),
        ruleStages: RULE_STAGE_SCHEMA({
          description:
            'Select specific stage(s) of the user lifecycle that this rule will run for',
        }),
      },
      required: ['fuzziness', 'ruleStages'],
    }
  }

  public async computeRule() {
    const { fuzziness, screeningTypes, ruleStages } = this.parameters

    if (
      hasFeature('ACURIS') ||
      hasFeature('DOW_JONES') ||
      hasFeature('OPEN_SANCTIONS')
    ) {
      return
    }

    if (
      ruleStages &&
      ruleStages.length > 0 &&
      !ruleStages.includes(this.stage)
    ) {
      return
    }

    const user = this.user as User
    if (
      !isConsumerUser(this.user) ||
      !user.userDetails ||
      !user.userDetails.name
    ) {
      return
    }

    const hitResult: RuleHitResult = []
    const yearOfBirth = user.userDetails.dateOfBirth
      ? dayjs(user.userDetails.dateOfBirth).year()
      : undefined
    const name = formatConsumerName(user.userDetails.name)
    if (!name) {
      return
    }

    const hitContext = {
      entity: 'USER' as const,
      userId: this.user.userId,
      entityType: 'CONSUMER_NAME' as const,
      ruleInstanceId: this.ruleInstance.id ?? '',
      isOngoingScreening: this.stage === 'ONGOING',
      searchTerm: name,
    }
    const result = await this.sanctionsService.search(
      {
        searchTerm: name,
        yearOfBirth,
        types: screeningTypes,
        fuzziness: fuzziness / 100,
        monitoring: { enabled: this.stage === 'ONGOING' },
      },
      hitContext,
      {
        stage: this.stage,
      }
    )
    if (result.hitsCount > 0) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: this.getUserVars(),
        sanctionsDetails: [
          {
            name,
            entityType: 'CONSUMER_NAME',
            searchId: result.searchId,
            hitContext,
          },
        ],
      })
    }
    return hitResult
  }
}
