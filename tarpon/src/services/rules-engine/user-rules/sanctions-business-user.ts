import { JSONSchemaType } from 'ajv'

import { isEmpty } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  ENABLE_ONGOING_SCREENING_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  STOPWORDS_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isBusinessUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import {
  getEntityTypeForSearch,
  getFuzzinessSettings,
  getStopwordSettings,
} from '../utils/rule-utils'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { Business } from '@/@types/openapi-public/Business'
import dayjs from '@/utils/dayjs'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { getDefaultProvider } from '@/services/sanctions/utils'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'

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
  screeningTypes?: SanctionsSearchType[]
  fuzziness: number
  ongoingScreening: boolean
  fuzzinessSetting: FuzzinessSettingOptions
  stopwords?: string[]
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
        screeningTypes: SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing business users including shareholders and directors after it is enabled.',
        }),
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
        stopwords: STOPWORDS_OPTIONAL_SCHEMA(),
      },
      required: ['fuzziness', 'fuzzinessSetting'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const {
      fuzziness,
      entityTypes,
      screeningTypes,
      ongoingScreening,
      fuzzinessSetting,
      stopwords,
    } = this.parameters

    if (
      isEmpty(entityTypes) ||
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
      ...(business.directors?.map((person) => ({
        entityType: 'DIRECTOR' as const,
        name: formatConsumerName(person.generalDetails?.name) || '',
        dateOfBirth: person.generalDetails.dateOfBirth,
      })) ?? []),
      ...(business.shareHolders?.map((person) => ({
        entityType: 'SHAREHOLDER' as const,
        name: formatConsumerName(person.generalDetails?.name) || '',
        dateOfBirth: person.generalDetails?.dateOfBirth,
      })) ?? []),
    ].filter(
      (entity) => entity.name && entityTypes?.includes(entity.entityType)
    )
    if (!entities.length) {
      return
    }
    const provider = getDefaultProvider()

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
              types: screeningTypes,
              fuzziness: fuzziness / 100,
              monitoring: { enabled: ongoingScreening },
              ...getEntityTypeForSearch(
                provider,
                entity.entityType === 'LEGAL_NAME' ? 'BUSINESS' : 'PERSON'
              ),
              ...getFuzzinessSettings(provider, fuzzinessSetting),
              ...getStopwordSettings(provider, stopwords),
            },
            hitContext
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
