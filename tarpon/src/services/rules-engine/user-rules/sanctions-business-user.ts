import { JSONSchemaType } from 'ajv'

import { isEmpty } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  STOPWORDS_OPTIONAL_SCHEMA,
  GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  IS_ACTIVE_SCHEMA,
  PARTIAL_MATCH_SCHEMA,
  RULE_STAGE_SCHEMA,
  SCREENING_PROFILE_ID_SCHEMA,
  FUZZY_ADDRESS_MATCHING_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isBusinessUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import {
  getEntityTypeForSearch,
  getFuzzinessSettings,
  getFuzzyAddressMatchingParameters,
  getIsActiveParameters,
  getPartialMatchParameters,
  getStopwordSettings,
} from '../utils/rule-utils'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { Business } from '@/@types/openapi-public/Business'
import dayjs from '@/utils/dayjs'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { RuleStage } from '@/@types/openapi-internal/RuleStage'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import { Address } from '@/@types/openapi-public/Address'

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
  fuzzinessSetting: FuzzinessSettingOptions
  screeningProfileId: string
  ruleStages: RuleStage[]
  stopwords?: string[]
  isActive?: boolean
  partialMatch?: boolean
  fuzzyAddressMatching?: boolean
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
        screeningTypes: GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA(),
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
        ruleStages: RULE_STAGE_SCHEMA({
          description:
            'Select specific stage(s) of the user lifecycle that this rule will run for',
        }),
        stopwords: STOPWORDS_OPTIONAL_SCHEMA(),
        isActive: IS_ACTIVE_SCHEMA,
        partialMatch: PARTIAL_MATCH_SCHEMA,
        screeningProfileId: SCREENING_PROFILE_ID_SCHEMA(),
        fuzzyAddressMatching: FUZZY_ADDRESS_MATCHING_SCHEMA,
      },
      required: [
        'fuzziness',
        'ruleStages',
        'fuzzinessSetting',
        'screeningProfileId',
      ],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const {
      fuzziness,
      entityTypes,
      screeningTypes,
      ruleStages,
      fuzzinessSetting,
      stopwords,
      isActive,
      partialMatch,
      screeningProfileId,
      fuzzyAddressMatching,
    } = this.parameters

    if (
      isEmpty(entityTypes) ||
      !isBusinessUser(this.user) ||
      (ruleStages && ruleStages.length > 0 && !ruleStages.includes(this.stage))
    ) {
      return
    }
    const business = this.user as Business
    const entities: Array<{
      entityType: SanctionsDetailsEntityType
      name: string | undefined
      dateOfBirth?: string
      addresses?: Address[]
    }> = [
      {
        entityType: 'LEGAL_NAME' as const,
        name: business.legalEntity.companyGeneralDetails.legalName ?? '',
        addresses: business.legalEntity.contactDetails?.addresses,
      },
      ...(business.directors?.map((person) => ({
        entityType: 'DIRECTOR' as const,
        name: formatConsumerName(person.generalDetails?.name) || '',
        dateOfBirth: person.generalDetails.dateOfBirth,
        addresses: person.contactDetails?.addresses,
      })) ?? []),
      ...(business.shareHolders?.map((person) => ({
        entityType: 'SHAREHOLDER' as const,
        name: formatConsumerName(person.generalDetails?.name) || '',
        dateOfBirth: person.generalDetails?.dateOfBirth,
        addresses: person.contactDetails?.addresses,
      })) ?? []),
    ].filter(
      (entity) => entity.name && entityTypes?.includes(entity.entityType)
    )
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
            isOngoingScreening: this.stage === 'ONGOING',
            searchTerm: entity.name,
            yearOfBirth,
          }
          const result = await this.sanctionsService.search(
            {
              searchTerm: entity.name ?? '',
              yearOfBirth,
              types: screeningTypes,
              fuzziness: fuzziness / 100,
              monitoring: { enabled: this.stage === 'ONGOING' },
              ...getEntityTypeForSearch(
                providers,
                entity.entityType === 'LEGAL_NAME' ? 'BUSINESS' : 'PERSON'
              ),
              ...getFuzzinessSettings(providers, fuzzinessSetting),
              ...getStopwordSettings(providers, stopwords),
              ...getIsActiveParameters(providers, screeningTypes, isActive),
              ...getPartialMatchParameters(providers, partialMatch),
              ...(providers.includes(SanctionsDataProviders.ACURIS) &&
              screeningProfileId
                ? { screeningProfileId }
                : {}),
              ...getFuzzyAddressMatchingParameters(
                providers,
                fuzzyAddressMatching,
                entity.addresses
              ),
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
