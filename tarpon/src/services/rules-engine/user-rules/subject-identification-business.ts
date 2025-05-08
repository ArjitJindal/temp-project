import { JSONSchemaType } from 'ajv'
import {
  ENABLE_ONGOING_SCREENING_SCHEMA,
  FUZZINESS_RANGE_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isBusinessUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { getEntityTypeForSearch } from '../utils/rule-utils'
import { UserRule } from './rule'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { Business } from '@/@types/openapi-public/Business'
import dayjs from '@/utils/dayjs'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { getDefaultProviders } from '@/services/sanctions/utils'

export type SubjectIdentificationBusinessUserRuleParameters = {
  fuzzinessRange: {
    lowerBound: number
    upperBound: number
  }
  ongoingScreening: boolean
  listId: string
}

export default class SubjectIdentificationBusinessUserRule extends UserRule<SubjectIdentificationBusinessUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SubjectIdentificationBusinessUserRuleParameters> {
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
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing business users after it is enabled.',
        }),
        listId: {
          type: 'string',
          title: 'List ID',
          description:
            'Provide a 314(a) List ID against which business names will be checked for subject identification',
        },
      },
      required: ['fuzzinessRange', 'listId'],
    }
  }

  public async computeRule() {
    const { fuzzinessRange, ongoingScreening, listId } = this.parameters

    if (
      !isBusinessUser(this.user) ||
      (this.ongoingScreeningMode && !ongoingScreening)
    ) {
      return
    }
    const business = this.user as Business
    const entities: Array<{
      entityType: SanctionsDetailsEntityType
      name: string | undefined
      dateOfBirth?: string
    }> = [
      {
        entityType: 'LEGAL_NAME' as const,
        name: business.legalEntity.companyGeneralDetails.legalName ?? '',
      },
    ].filter((entity) => entity.name)
    if (!entities.length) {
      return
    }
    const providers = getDefaultProviders()

    const hitResult: RuleHitResult = []
    const sanctionsDetails = (
      await Promise.all(
        entities.map(async (entity) => {
          const yearOfBirth = entity.dateOfBirth
            ? dayjs(entity.dateOfBirth).year()
            : undefined
          const hitContext = {
            entity: 'USER' as const,
            entityType: entity.entityType,
            userId: this.user.userId,
            ruleInstanceId: this.ruleInstance.id ?? '',
            isOngoingScreening: this.ongoingScreeningMode,
            searchTerm: entity.name,
            yearOfBirth,
          }
          const result = await this.sanctionsService.search(
            {
              searchTerm: entity.name ?? '',
              yearOfBirth,
              fuzzinessRange,
              fuzziness: undefined,
              monitoring: { enabled: ongoingScreening },
              ...getEntityTypeForSearch(
                providers,
                entity.entityType === 'LEGAL_NAME' ? 'BUSINESS' : 'PERSON'
              ),
            },
            hitContext,
            {
              providerName: 'list',
              listId,
              stage: this.stage,
            }
          )
          if (result.hitsCount > 0) {
            const resultDetails: SanctionsDetails = {
              name: entity.name ?? '',
              entityType: entity.entityType,
              searchId: result.searchId,
              hitContext,
            }
            return resultDetails
          }
        })
      )
    ).filter(Boolean) as SanctionsDetails[]
    if (sanctionsDetails.length > 0) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: this.getUserVars(),
        sanctionsDetails,
      })
    }
    return hitResult
  }
}
