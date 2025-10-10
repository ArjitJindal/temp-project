import { JSONSchemaType } from 'ajv'

import { FUZZINESS_RANGE_SCHEMA } from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { User } from '@/@types/openapi-public/User'
import { ListRepository } from '@/services/list/repositories/list-repository'

export type SubjectIdentificationConsumerUserRuleParameters = {
  fuzzinessRange: {
    lowerBound: number
    upperBound: number
  }
  listId: string
}

export default class SubjectIdentificationConsumerUser extends UserRule<SubjectIdentificationConsumerUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SubjectIdentificationConsumerUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        fuzzinessRange: FUZZINESS_RANGE_SCHEMA({
          title: 'Fuzziness range',
          description:
            'Enter fuzziness % to set the flexibility of search. 0% will look for exact matches only & 100% will look for even the slightest match in spellings/phonetics',
          uiSchema: {
            subtype: 'NUMBER_SLIDER_SINGLE',
          },
        }),
        listId: {
          type: 'string',
          title: 'List ID',
          description:
            'Provide a 314(a) List ID against which user names will be checked for subject identification',
        },
      },
      required: ['fuzzinessRange', 'listId'],
    }
  }

  public async computeRule() {
    const { fuzzinessRange, listId } = this.parameters
    const user = this.user as User
    if (
      !isConsumerUser(this.user) ||
      !user.userDetails ||
      !user.userDetails.name
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
    const listRepository = new ListRepository(this.tenantId, this.dynamoDb)
    const listHeader = await listRepository.getListHeader(listId)
    if (!listHeader) {
      return
    }
    const listVersion = listHeader.version
    const result = await this.sanctionsService.search(
      {
        searchTerm: name,
        fuzzinessRange,
        fuzziness: undefined,
        monitoring: { enabled: false },
        listVersion,
      },
      hitContext,
      { providerName: 'list', listId, stage: this.stage }
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
    return {
      ruleHitResult: hitResult,
    }
  }
}
