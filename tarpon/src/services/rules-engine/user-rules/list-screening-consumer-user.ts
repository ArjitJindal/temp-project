import { JSONSchemaType } from 'ajv'

import {
  ENABLE_ONGOING_SCREENING_SCHEMA,
  FUZZINESS_RANGE_SCHEMA,
  SANCTIONS_SCREENING_VALUES_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { User } from '@/@types/openapi-public/User'
import { ListRepository } from '@/services/list/repositories/list-repository'

type ScreeningValues = 'NRIC'
export type ListScreeningConsumerUserRuleParameters = {
  fuzzinessRange: {
    lowerBound: number
    upperBound: number
  }
  ongoingScreening: boolean
  listId: string
  screeningValues?: ScreeningValues[]
}

export default class ListScreeningConsumerUser extends UserRule<ListScreeningConsumerUserRuleParameters> {
  public static getSchema(): JSONSchemaType<ListScreeningConsumerUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        fuzzinessRange: FUZZINESS_RANGE_SCHEMA({
          title: 'Fuzziness range',
          description:
            'Enter fuzziness % to set the flexibility of search. 0% will look for exact matches only & 100% will look for even the slightest match in spellings/phonetics',
        }),
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing consumer users after it is enabled.',
        }),
        screeningValues: SANCTIONS_SCREENING_VALUES_SCHEMA({
          description:
            'Select the screening attributes to be used for the screening',
        }),
        listId: {
          type: 'string',
          title: 'List ID',
          description:
            'Provide a List ID against which {{userAlias}} names will be checked',
        },
      },
      required: ['fuzzinessRange'],
    }
  }

  public async computeRule() {
    const { screeningValues, fuzzinessRange, ongoingScreening, listId } =
      this.parameters
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
        monitoring: { enabled: ongoingScreening },
        listVersion,
        ...(screeningValues?.includes('NRIC')
          ? {
              documentId:
                user.legalDocuments?.map((doc) => doc.documentNumber) ?? [],
            }
          : {}),
      },
      {
        context: hitContext,
        providerOverrides: { providerName: 'list', listId, stage: this.stage },
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
    return {
      ruleHitResult: hitResult,
    }
  }
}
