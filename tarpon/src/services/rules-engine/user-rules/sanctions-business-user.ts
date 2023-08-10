import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  FUZZINESS_SCHEMA,
  ENABLE_ONGOING_SCREENING_SCHEMA,
  SANCTIONS_SCREENING_TYPES_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isBusinessUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { SanctionsService } from '@/services/sanctions'
import { Business } from '@/@types/openapi-public/Business'
import dayjs from '@/utils/dayjs'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'

const BUSINESS_USER_ENTITY_TYPES: Array<{
  value: SanctionsDetailsEntityType
  label: string
}> = [
  { value: 'LEGAL_NAME', label: 'Legal Name' },
  { value: 'SHAREHOLDER', label: 'Shareholder' },
  { value: 'DIRECTOR', label: 'Director' },
]

export type SanctionsBusinessUserRuleParameters = {
  entityTypes?: SanctionsDetailsEntityType[]
  screeningTypes: SanctionsSearchType[]
  fuzziness: number
  ongoingScreening: boolean
}

export default class SanctionsBusinessUserRule extends UserRule<SanctionsBusinessUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsBusinessUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        entityTypes: {
          type: 'array',
          title: 'Entity',
          description:
            'Select the entities of the business that you want to run the screening',
          items: {
            type: 'string',
            enum: BUSINESS_USER_ENTITY_TYPES.map((v) => v.value),
            enumNames: BUSINESS_USER_ENTITY_TYPES.map((v) => v.label),
          },
          uniqueItems: true,
          nullable: true,
        },
        screeningTypes: SANCTIONS_SCREENING_TYPES_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing business users including shareholders and directors after it is enabled.',
        }),
      },
      required: ['fuzziness', 'screeningTypes'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { fuzziness, entityTypes, screeningTypes, ongoingScreening } =
      this.parameters

    if (
      _.isEmpty(entityTypes) ||
      _.isEmpty(screeningTypes) ||
      !isBusinessUser(this.user) ||
      (this.ongoingScreeningMode && !ongoingScreening)
    ) {
      return
    }
    const business = this.user as Business
    const entities: Array<{
      entityType: SanctionsDetailsEntityType
      name: string
      dateOfBirth?: string
    }> = [
      {
        entityType: 'LEGAL_NAME' as const,
        name: business.legalEntity.companyGeneralDetails.legalName,
      },
      ...(business.directors?.map((person) => ({
        entityType: 'DIRECTOR' as const,
        name: formatConsumerName(person.generalDetails.name) || '',
        dateOfBirth: person.generalDetails.dateOfBirth,
      })) ?? []),
      ...(business.shareHolders?.map((person) => ({
        entityType: 'SHAREHOLDER' as const,
        name: formatConsumerName(person.generalDetails.name) || '',
        dateOfBirth: person.generalDetails.dateOfBirth,
      })) ?? []),
    ].filter((entity) => entity.name)

    const sanctionsService = new SanctionsService(this.tenantId)
    const hitResult: RuleHitResult = []
    const sanctionsDetails: SanctionsDetails[] = []
    for (const entity of entities) {
      const yearOfBirth = entity.dateOfBirth
        ? dayjs(entity.dateOfBirth).year()
        : undefined
      const result = await sanctionsService.search(
        {
          searchTerm: entity.name,
          yearOfBirth,
          types: screeningTypes,
          fuzziness: fuzziness / 100,
          monitoring: { enabled: ongoingScreening },
        },
        { userId: this.user.userId }
      )
      if (result.data && result.data.length > 0) {
        sanctionsDetails.push({
          name: entity.name,
          entityType: entity.entityType,
          searchId: result.searchId,
        })
      }
    }
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
