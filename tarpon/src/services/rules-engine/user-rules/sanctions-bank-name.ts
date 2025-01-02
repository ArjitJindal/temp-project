import { JSONSchemaType } from 'ajv'
import pLimit from 'p-limit'

import { uniqBy } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  ENABLE_ONGOING_SCREENING_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { User } from '@/@types/openapi-public/User'

const caConcurrencyLimit = pLimit(10)

type BankInfo = { bankName?: string; iban?: string }

export type SanctionsBankUserRuleParameters = {
  screeningTypes?: SanctionsSearchType[]
  ongoingScreening: boolean
  fuzziness: number
}

export default class SanctionsBankUserRule extends UserRule<SanctionsBankUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsBankUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        screeningTypes: SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing bank names after it is enabled.',
        }),
      },
      required: ['fuzziness'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { fuzziness, screeningTypes, ongoingScreening } = this.parameters

    if (this.ongoingScreeningMode && !ongoingScreening) {
      return
    }
    const user = this.user as User
    const bankInfos = (user.savedPaymentDetails || [])
      ?.map((paymentDetails) => {
        if (paymentDetails.method === 'IBAN') {
          return {
            bankName: paymentDetails.bankName,
            iban: paymentDetails.IBAN,
          }
        }
        if (
          paymentDetails.method === 'GENERIC_BANK_ACCOUNT' ||
          paymentDetails.method === 'ACH' ||
          paymentDetails.method === 'SWIFT'
        ) {
          return {
            bankName: paymentDetails.bankName,
            iban: paymentDetails.accountNumber,
          }
        }
      })
      .filter(Boolean) as BankInfo[]

    const bankInfosToCheck = uniqBy(
      bankInfos.filter((bankInfo) => bankInfo.bankName),
      (bankInfo) => JSON.stringify(bankInfo)
    )

    const hitResult: RuleHitResult = []
    const sanctionsDetails: (SanctionsDetails | undefined)[] =
      await Promise.all(
        bankInfosToCheck.map((bankInfo) =>
          caConcurrencyLimit(async () => {
            const bankName = bankInfo.bankName
            if (!bankName) {
              return
            }
            const hitContext = {
              entity: 'BANK' as const,
              userId: this.user.userId,
              ruleInstanceId: this.ruleInstance.id ?? '',
              iban: bankInfo.iban,
              isOngoingScreening: this.ongoingScreeningMode,
              searchTerm: bankName,
            }
            const result = await this.sanctionsService.search(
              {
                searchTerm: bankName,
                types: screeningTypes,
                fuzziness: fuzziness / 100,
                monitoring: { enabled: ongoingScreening },
              },
              hitContext
            )
            let sanctionsDetails: SanctionsDetails
            if (result.hitsCount > 0) {
              sanctionsDetails = {
                name: bankName,
                iban: bankInfo.iban,
                searchId: result.searchId,
                hitContext,
              }
              return sanctionsDetails
            }
          })
        )
      )

    const filteredSanctionsDetails = sanctionsDetails.filter(
      (searchResponse): searchResponse is SanctionsDetails => !!searchResponse
    )

    if (filteredSanctionsDetails.length > 0) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: this.getUserVars(),
        sanctionsDetails: filteredSanctionsDetails,
      })
    }
    return hitResult
  }
}
