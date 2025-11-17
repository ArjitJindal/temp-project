import { JSONSchemaType } from 'ajv'

import isEmpty from 'lodash/isEmpty'
import {
  FUZZINESS_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  STOPWORDS_OPTIONAL_SCHEMA,
  GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  IS_ACTIVE_SCHEMA,
  PARTIAL_MATCH_SCHEMA,
  USER_RULE_STAGE_SCHEMA,
  SCREENING_PROFILE_ID_SCHEMA,
  FUZZY_ADDRESS_MATCHING_SCHEMA,
  ENABLE_SHORT_NAME_MATCHING_SCHEMA,
  ENABLE_PHONETIC_MATCHING_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isBusinessUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import {
  getEnablePhoneticMatchingParameters,
  getEnableShortNameMatchingParameters,
  getEntityTypeForSearch,
  getFuzzinessSettings,
  getFuzzyAddressMatchingParameters,
  getIsActiveParameters,
  getPartialMatchParameters,
  getStopwordSettings,
} from '../utils/rule-utils'
import { UserRule } from './rule'
import { SanctionsRuleResult } from './sanctions-bank-name'
import {
  formatConsumerName,
  formatShareHolderName,
  isPerson,
} from '@/utils/helpers'
import { SanctionsDetailsEntityType } from '@/@types/openapi-internal/SanctionsDetailsEntityType'
import { Business } from '@/@types/openapi-public/Business'
import dayjs from '@/utils/dayjs'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { UserRuleStage } from '@/@types/openapi-internal/UserRuleStage'
import { SanctionsDataProviders } from '@/services/sanctions/types'
import { Address } from '@/@types/openapi-public/Address'
import { notNullish } from '@/utils/array'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'

const BUSINESS_USER_ENTITY_TYPES: Array<{
  value: SanctionsDetailsEntityType
  label: string
}> = [
  { value: 'LEGAL_NAME', label: 'Legal Name' },
  { value: 'SHAREHOLDER', label: 'Shareholder' },
  { value: 'DIRECTOR', label: 'Director' },
]

export type SanctionsBusinessUserRuleParameters = {
  entityTypes: SanctionsDetailsEntityType[]
  screeningTypes?: GenericSanctionsSearchType[]
  fuzziness: number
  fuzzinessSetting: FuzzinessSettingOptions
  screeningProfileId: string
  ruleStages: UserRuleStage[]
  stopwords?: string[]
  isActive?: boolean
  partialMatch?: boolean
  fuzzyAddressMatching?: boolean
  enableShortNameMatching?: boolean
  enablePhoneticMatching?: boolean
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
        },
        screeningTypes: GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA(),
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
        enableShortNameMatching: ENABLE_SHORT_NAME_MATCHING_SCHEMA(),
        enablePhoneticMatching: ENABLE_PHONETIC_MATCHING_SCHEMA(),
        ruleStages: USER_RULE_STAGE_SCHEMA({
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
        'entityTypes',
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
      enableShortNameMatching,
      enablePhoneticMatching,
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
        name: formatShareHolderName(person) || '',
        dateOfBirth: isPerson(person)
          ? person.generalDetails.dateOfBirth
          : person.companyRegistrationDetails?.dateOfRegistration,
        addresses: person.contactDetails?.addresses,
      })) ?? []),
    ].filter((entity) => entity.name && entityTypes.includes(entity.entityType))
    if (!entities.length) {
      return
    }
    const providers = getDefaultProviders()

    const hitResult: RuleHitResult = []
    const sanctionsDetails: (SanctionsRuleResult | undefined)[] =
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
                entity.entityType === 'LEGAL_NAME' ? 'BUSINESS' : 'PERSON'
              ),
              ...getFuzzinessSettings(fuzzinessSetting),
              ...getStopwordSettings(stopwords),
              ...getIsActiveParameters(screeningTypes, isActive),
              ...getPartialMatchParameters(partialMatch),
              ...(providers.includes(SanctionsDataProviders.ACURIS) &&
              screeningProfileId
                ? { screeningProfileId }
                : {}),
              ...getFuzzyAddressMatchingParameters(
                providers,
                fuzzyAddressMatching,
                entity.addresses
              ),
              ...getEnableShortNameMatchingParameters(enableShortNameMatching),
              ...getEnablePhoneticMatchingParameters(enablePhoneticMatching),
            },
            { context: hitContext }
          )
          const resultDetails: SanctionsDetails = {
            name: entity.name ?? '',
            entityType: entity.entityType,
            searchId: result.searchId,
            hitContext,
          }
          return {
            sanctionsDetails: resultDetails,
            hitsCount: result.hitsCount,
          }
        })
      )
    const filteredSanctionsDetails = sanctionsDetails.filter(notNullish)
    if (
      sanctionsDetails.length > 0 &&
      filteredSanctionsDetails.some((detail) => detail.hitsCount > 0)
    ) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: this.getUserVars(),
        sanctionsDetails: filteredSanctionsDetails
          .filter((detail) => detail.hitsCount > 0)
          .map((detail) => detail.sanctionsDetails),
      })
    }
    return {
      ruleHitResult: hitResult,
      ruleExecutionResult: {
        sanctionsDetails: filteredSanctionsDetails.map((detail) => ({
          ...detail.sanctionsDetails,
          isRuleHit: detail.hitsCount > 0,
        })),
      },
    }
  }
}
