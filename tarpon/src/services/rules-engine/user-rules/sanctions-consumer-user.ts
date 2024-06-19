import { JSONSchemaType } from 'ajv'

import {
  FUZZINESS_SCHEMA,
  ENABLE_ONGOING_SCREENING_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import dayjs from '@/utils/dayjs'
import { User } from '@/@types/openapi-public/User'

export type SanctionsConsumerUserRuleParameters = {
  screeningTypes?: SanctionsSearchType[]
  fuzziness: number
  ongoingScreening: boolean
}

export default class SanctionsConsumerUserRule extends UserRule<SanctionsConsumerUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsConsumerUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        screeningTypes: SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing consumer users after it is enabled.',
        }),
      },
      required: ['fuzziness'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { fuzziness, screeningTypes, ongoingScreening } = this.parameters
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
    const yearOfBirth = user.userDetails.dateOfBirth
      ? dayjs(user.userDetails.dateOfBirth).year()
      : undefined
    const name = formatConsumerName(user.userDetails.name)
    if (!name) {
      return
    }

    const result = await this.sanctionsService.search(
      {
        searchTerm: name,
        yearOfBirth,
        types: screeningTypes,
        fuzziness: fuzziness / 100,
        monitoring: { enabled: ongoingScreening },
      },
      {
        entity: 'USER',
        userId: this.user.userId,
        ruleInstanceId: this.ruleInstance.id ?? '',
        isOngoingScreening: this.ongoingScreeningMode,
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
          },
        ],
      })
    }
    return hitResult
  }
}
