import { JSONSchemaType } from 'ajv'
import {
  FUZZINESS_RANGE_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  GENERIC_SCREENING_VALUES_SCHEMA,
  STOPWORDS_OPTIONAL_SCHEMA,
  IS_ACTIVE_SCHEMA,
  PARTIAL_MATCH_SCHEMA,
  USER_RULE_STAGE_SCHEMA,
  SCREENING_PROFILE_ID_SCHEMA,
  FUZZY_ADDRESS_MATCHING_SCHEMA,
  ENABLE_SHORT_NAME_MATCHING_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import {
  getEnableShortNameMatchingParameters,
  getFuzzyAddressMatchingParameters,
  getIsActiveParameters,
  getPartialMatchParameters,
  getStopwordSettings,
} from '../utils/rule-utils'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'
import dayjs from '@/utils/dayjs'
import { User } from '@/@types/openapi-public/User'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { getDefaultProviders } from '@/services/sanctions/utils'
import { UserRuleStage } from '@/@types/openapi-internal/UserRuleStage'
import { SanctionsDataProviders } from '@/services/sanctions/types'

export type GenericScreeningValues =
  | 'NATIONALITY'
  | 'YOB'
  | 'GENDER'
  | 'ADDRESS'
export type GenericSanctionsConsumerUserRuleParameters = {
  screeningTypes?: GenericSanctionsSearchType[]
  fuzzinessRange: {
    lowerBound: number
    upperBound: number
  }
  screeningValues?: GenericScreeningValues[]
  // PEPRank?: PepRank //Open-sanctions does not provide PEP rank data
  fuzzinessSetting: FuzzinessSettingOptions
  screeningProfileId: string
  stopwords?: string[]
  isActive?: boolean
  partialMatch?: boolean
  ruleStages: UserRuleStage[]
  fuzzyAddressMatching?: boolean
  enableShortNameMatching?: boolean
}

export default class GenericSanctionsConsumerUserRule extends UserRule<GenericSanctionsConsumerUserRuleParameters> {
  public static getSchema(): JSONSchemaType<GenericSanctionsConsumerUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        screeningTypes: GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({
          uiSchema: {
            subtype: 'GENERIC_SANCTIONS_SCREENING_TYPES',
          },
        }),
        fuzzinessRange: FUZZINESS_RANGE_SCHEMA({
          title: 'Fuzziness range',
          description:
            'Enter fuzziness % to set the flexibility of search. 0% will look for exact matches only & 100% will look for even the slightest match in spellings/phonetics',
        }),
        screeningValues: GENERIC_SCREENING_VALUES_SCHEMA(
          {
            description:
              'Select the screening attributes to be used for the screening',
          },
          ['NATIONALITY', 'YOB', 'GENDER']
        ),
        // PEPRank: PEP_RANK_SCHEMA({}),  //Open-sanctions does not provide PEP rank data,
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
        enableShortNameMatching: ENABLE_SHORT_NAME_MATCHING_SCHEMA(),
        ruleStages: USER_RULE_STAGE_SCHEMA({
          description:
            'Select specific stage(s) of the user lifecycle that this rule will run for',
        }),
        partialMatch: PARTIAL_MATCH_SCHEMA,
        stopwords: STOPWORDS_OPTIONAL_SCHEMA(),
        isActive: IS_ACTIVE_SCHEMA,
        screeningProfileId: SCREENING_PROFILE_ID_SCHEMA(),
        fuzzyAddressMatching: FUZZY_ADDRESS_MATCHING_SCHEMA,
      },
      required: [
        'fuzzinessRange',
        'fuzzinessSetting',
        'ruleStages',
        'screeningProfileId',
      ],
    }
  }

  public async computeRule() {
    const {
      fuzzinessRange,
      screeningTypes,
      ruleStages,
      screeningValues,
      // PEPRank,
      fuzzinessSetting,
      stopwords,
      isActive,
      partialMatch,
      screeningProfileId,
      fuzzyAddressMatching,
      enableShortNameMatching,
    } = this.parameters
    const user = this.user as User
    if (
      !isConsumerUser(this.user) ||
      !user.userDetails ||
      !user.userDetails.name ||
      (ruleStages && ruleStages.length > 0 && !ruleStages.includes(this.stage))
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

    const hitContext = {
      entity: 'USER' as const,
      userId: this.user.userId,
      entityType: 'CONSUMER_NAME' as const,
      ruleInstanceId: this.ruleInstance.id ?? '',
      isOngoingScreening: this.ongoingScreeningMode,
      searchTerm: name,
    }
    const providers = getDefaultProviders()
    const result = await this.sanctionsService.search(
      {
        searchTerm: name,
        ...(screeningValues?.includes('YOB') ? { yearOfBirth } : {}),
        ...(screeningValues?.includes('GENDER') && user.userDetails.gender
          ? {
              gender:
                user.userDetails.gender === 'M'
                  ? 'Male'
                  : user.userDetails.gender === 'F'
                  ? 'Female'
                  : 'NB',
            }
          : {}),
        types: screeningTypes,
        fuzzinessRange,
        fuzziness: undefined,
        isOngoingScreening: this.ongoingScreeningMode,
        monitoring: { enabled: this.stage === 'ONGOING' },
        // PEPRank, //Open-sanctions does not provide PEP rank data
        ...(screeningValues?.includes('NATIONALITY')
          ? {
              nationality: user.userDetails.countryOfNationality
                ? [user.userDetails.countryOfNationality]
                : [],
            }
          : {}),
        orFilters: ['yearOfBirth', 'gender', 'nationality'],
        entityType: 'PERSON',
        fuzzinessSettings: {
          sanitizeInputForFuzziness:
            fuzzinessSetting === 'IGNORE_SPACES_AND_SPECIAL_CHARACTERS',
          similarTermsConsideration:
            fuzzinessSetting === 'TOKENIZED_SIMILARITY_MATCHING',
          levenshteinDistanceDefault:
            fuzzinessSetting === 'LEVENSHTEIN_DISTANCE_DEFAULT',
          jarowinklerDistance: fuzzinessSetting === 'JAROWINKLER_DISTANCE',
        },
        ...getIsActiveParameters(screeningTypes, isActive),
        ...getStopwordSettings(stopwords),
        ...getPartialMatchParameters(partialMatch),
        ...(providers.includes(SanctionsDataProviders.ACURIS)
          ? { screeningProfileId: screeningProfileId ?? undefined }
          : {}),
        ...getFuzzyAddressMatchingParameters(
          providers,
          fuzzyAddressMatching,
          user.contactDetails?.addresses
        ),
        ...getEnableShortNameMatchingParameters(enableShortNameMatching),
      },
      hitContext,
      undefined
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
