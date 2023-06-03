import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  FUZZINESS_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  ENABLE_ONGOING_SCREENING_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsService } from '@/services/sanctions'
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
            'Enabling ongoing screening will do a historic screening of all the existing consumer users.',
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
      _.isEmpty(screeningTypes) ||
      !isConsumerUser(this.user) ||
      !user.userDetails ||
      !user.userDetails.name
    ) {
      return
    }

    const sanctionsService = new SanctionsService(this.tenantId)
    const hitResult: RuleHitResult = []
    const yearOfBirth = user.userDetails.dateOfBirth
      ? dayjs(user.userDetails.dateOfBirth).year()
      : undefined
    const name = formatConsumerName(user.userDetails.name) || ''
    const result = await sanctionsService.search({
      searchTerm: name || '',
      yearOfBirth,
      types: screeningTypes,
      fuzziness: fuzziness / 100,
      monitoring: { enabled: ongoingScreening },
    })
    if (result.data && result.data.length > 0) {
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
