import { JSONSchemaType } from 'ajv'
import {
  ENABLE_ONGOING_SCREENING_SCHEMA,
  FUZZINESS_RANGE_SCHEMA,
  FUZZINESS_SETTINGS_SCHEMA,
  GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  GENERIC_SCREENING_VALUES_SCHEMA,
  STOPWORDS_OPTIONAL_SCHEMA,
  IS_ACTIVE_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { getIsActiveParameters, getStopwordSettings } from '../utils/rule-utils'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { GenericSanctionsSearchType } from '@/@types/openapi-internal/GenericSanctionsSearchType'
import dayjs from '@/utils/dayjs'
import { User } from '@/@types/openapi-public/User'
import { FuzzinessSettingOptions } from '@/@types/openapi-internal/FuzzinessSettingOptions'
import { getDefaultProviders } from '@/services/sanctions/utils'

export type GenericScreeningValues = 'NATIONALITY' | 'YOB' | 'GENDER'
export type GenericSanctionsConsumerUserRuleParameters = {
  screeningTypes?: GenericSanctionsSearchType[]
  fuzzinessRange: {
    lowerBound: number
    upperBound: number
  }
  ongoingScreening: boolean
  screeningValues?: GenericScreeningValues[]
  // PEPRank?: PepRank //Open-sanctions does not provide PEP rank data
  fuzzinessSetting: FuzzinessSettingOptions
  stopwords?: string[]
  isActive?: boolean
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
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing consumer users after it is enabled.',
        }),
        screeningValues: GENERIC_SCREENING_VALUES_SCHEMA({
          description:
            'Select the screening attributes to be used for the screening',
        }),
        // PEPRank: PEP_RANK_SCHEMA({}),  //Open-sanctions does not provide PEP rank data,
        fuzzinessSetting: FUZZINESS_SETTINGS_SCHEMA(),
        stopwords: STOPWORDS_OPTIONAL_SCHEMA(),
        isActive: IS_ACTIVE_SCHEMA,
      },
      required: ['fuzzinessRange', 'fuzzinessSetting'],
    }
  }

  public async computeRule() {
    const {
      fuzzinessRange,
      screeningTypes,
      ongoingScreening,
      screeningValues,
      // PEPRank,
      fuzzinessSetting,
      stopwords,
      isActive,
    } = this.parameters
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
        monitoring: { enabled: ongoingScreening },
        // PEPRank, //Open-sanctions does not provide PEP rank data
        documentId: user.legalDocuments?.map((doc) => doc.documentNumber) ?? [],
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
        ...getIsActiveParameters(providers, screeningTypes, isActive),
        ...getStopwordSettings(providers, stopwords),
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
