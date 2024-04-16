import { JSONSchemaType } from 'ajv'
import pLimit from 'p-limit'

import { isEmpty, uniqBy } from 'lodash'
import {
  FUZZINESS_SCHEMA,
  ENABLE_ONGOING_SCREENING_SCHEMA,
  SANCTIONS_SCREENING_TYPES_SCHEMA,
  RESOLVE_IBAN_NUMBER_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isBusinessUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { Business } from '@/@types/openapi-public/Business'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { logger } from '@/core/logger'

const caConcurrencyLimit = pLimit(10)

type BankInfo = { bankName?: string; iban?: string }

export type SanctionsBankUserRuleParameters = {
  resolveIban?: boolean
  screeningTypes: SanctionsSearchType[]
  ongoingScreening: boolean
  fuzziness: number
}

export default class SanctionsBankUserRule extends UserRule<SanctionsBankUserRuleParameters> {
  public static getSchema(): JSONSchemaType<SanctionsBankUserRuleParameters> {
    return {
      type: 'object',
      properties: {
        resolveIban: RESOLVE_IBAN_NUMBER_SCHEMA({
          uiSchema: {
            requiredFeatures: ['IBAN_RESOLUTION'],
          },
        }),
        screeningTypes: SANCTIONS_SCREENING_TYPES_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'It will do a screening every 24hrs of all the existing bank names after it is enabled.',
        }),
      },
      required: ['fuzziness', 'screeningTypes'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { fuzziness, resolveIban, screeningTypes, ongoingScreening } =
      this.parameters

    if (
      isEmpty(screeningTypes) ||
      !isBusinessUser(this.user) ||
      (this.ongoingScreeningMode && !ongoingScreening)
    ) {
      return
    }
    const business = this.user as Business
    let bankInfos = (business.savedPaymentDetails || [])
      ?.map((paymentDetails) => {
        if (paymentDetails.method === 'IBAN') {
          return {
            bankName: paymentDetails.bankName,
            iban: paymentDetails.IBAN,
          }
        }
        if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
          return {
            bankName: paymentDetails.bankName,
            iban: paymentDetails.accountNumber,
          }
        }
      })
      .filter(Boolean) as BankInfo[]

    if (resolveIban) {
      try {
        bankInfos = await this.ibanService.resolveBankNames(bankInfos)
      } catch (e) {
        logger.error(e)
      }
    }
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
            if (!bankName) return
            const result = await this.sanctionsService.search(
              {
                searchTerm: bankName,
                types: screeningTypes,
                fuzziness: fuzziness / 100,
                monitoring: { enabled: ongoingScreening },
              },
              {
                entity: 'BANK',
                userId: this.user.userId,
                ruleInstanceId: this.ruleInstance.id ?? '',
                iban: bankInfo.iban,
                isOngoingScreening: this.ongoingScreeningMode,
              }
            )
            let sanctionsDetails: SanctionsDetails
            if (result.data && result.data.length > 0) {
              sanctionsDetails = {
                name: bankName,
                iban: bankInfo.iban,
                searchId: result.searchId,
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
