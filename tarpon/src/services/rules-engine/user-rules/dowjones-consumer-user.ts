import { JSONSchemaType } from 'ajv'

import {
  ENABLE_ONGOING_SCREENING_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
  FUZZINESS_RANGE_SCHEMA,
  SANCTIONS_SCREENING_VALUES_SCHEMA,
  PEP_RANK_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isConsumerUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { formatConsumerName } from '@/utils/helpers'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import dayjs from '@/utils/dayjs'
import { User } from '@/@types/openapi-public/User'
import { PepRank } from '@/@types/openapi-internal/PepRank'

type ScreeningValues = 'NRIC' | 'NATIONALITY' | 'YOB' | 'GENDER'
export type DowJonesConsumerUserRuleParameters = {
  screeningTypes?: SanctionsSearchType[]
  fuzzinessRange: {
    lowerBound: number
    upperBound: number
  }
  ongoingScreening: boolean
  screeningValues?: ScreeningValues[]
  PEPRank?: PepRank
}

export default class DowJonesConsumerUserRule extends UserRule<DowJonesConsumerUserRuleParameters> {
  public static getSchema(): JSONSchemaType<DowJonesConsumerUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        screeningTypes: SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzzinessRange: FUZZINESS_RANGE_SCHEMA({
          uiSchema: {
            requiredFeatures: ['DOW_JONES'],
          },
          title: 'Fuzziness range',
          description:
            'Enter fuzziness % to set the flexibility of search. 0% will look for exact matches only & 100% will look for even the slightest match in spellings/ phonetics',
        }),
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing consumer users after it is enabled.',
        }),
        screeningValues: SANCTIONS_SCREENING_VALUES_SCHEMA({
          description:
            'Select the screening attributes to be used for the screening',
        }),
        PEPRank: PEP_RANK_SCHEMA({}),
      },
      required: ['fuzzinessRange'],
    }
  }

  public async computeRule() {
    const {
      fuzzinessRange,
      screeningTypes,
      ongoingScreening,
      screeningValues,
      PEPRank,
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
        monitoring: { enabled: ongoingScreening },
        PEPRank,
        documentId: user.legalDocuments?.map((doc) => doc.documentNumber) ?? [],
        allowDocumentMatches: screeningValues?.includes('NRIC'),
        ...(screeningValues?.includes('NATIONALITY')
          ? {
              nationality: user.userDetails.countryOfNationality
                ? [user.userDetails.countryOfNationality]
                : [],
            }
          : {}),
        orFilters: ['yearOfBirth', 'gender', 'nationality'],
      },
      hitContext,
      undefined,
      this.ongoingScreeningMode
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
