import { JSONSchemaType } from 'ajv'

import {
  ENABLE_ONGOING_SCREENING_SCHEMA,
  FUZZINESS_RANGE_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { User } from '@/@types/openapi-public/User'

export type OpenSanctionsConsumerUserRuleParameters = {
  fuzzinessRange: {
    lowerBound: number
    upperBound: number
  }
  ongoingScreening: boolean
}

export default class OpenSanctionsConsumerUserRule extends UserRule<OpenSanctionsConsumerUserRuleParameters> {
  public static getSchema(): JSONSchemaType<OpenSanctionsConsumerUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        fuzzinessRange: FUZZINESS_RANGE_SCHEMA({
          uiSchema: {
            requiredFeatures: ['OPEN_SANCTIONS'],
          },
          title: 'Fuzziness range',
          description:
            'Enter fuzziness % to set the flexibility of search. 0% will look for exact matches only & 100% will look for even the slightest match in spellings/ phonetics',
        }),
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing consumer users after it is enabled.',
        }),
      },
      required: ['fuzzinessRange'],
    }
  }

  public async computeRule() {
    const { fuzzinessRange, ongoingScreening } = this.parameters
    const user = this.user as User
    if (
      !isConsumerUser(this.user) ||
      !user.userDetails ||
      !user.userDetails.name ||
      (this.ongoingScreeningMode && !ongoingScreening)
    ) {
      return
    }

    const hitResult: RuleHitResult = []
    const name = formatConsumerName(user.userDetails.name)
    if (!name) {
      return
    }

    const hitContext = {
      entity: 'USER' as const,
      userId: this.user.userId,
      entityType: 'CONSUMER_NAME' as const,
      ruleInstanceId: this.ruleInstance.id ?? '',
      isOngoingScreening: this.ongoingScreeningMode,
      searchTerm: name,
    }
    const result = await this.sanctionsService.search(
      {
        searchTerm: name,
        fuzzinessRange,
        fuzziness: undefined,
        isOngoingScreening: this.ongoingScreeningMode,
        monitoring: { enabled: ongoingScreening },
      },
      hitContext,
      {
        stage: this.stage,
        providerName: 'open-sanctions',
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
