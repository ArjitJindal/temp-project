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
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsService } from '@/services/sanctions'
import { Business } from '@/@types/openapi-public/Business'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { IBANService } from '@/services/iban.com'
import { logger } from '@/core/logger'

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
        resolveIban: {
          type: 'boolean',
          title: 'Resolve IBAN number',
          description:
            'Enable if you want to identify Bank name using IBAN numbers.',
          nullable: true,
        },
        screeningTypes: SANCTIONS_SCREENING_TYPES_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
        ongoingScreening: ENABLE_ONGOING_SCREENING_SCHEMA({
          description:
            'Enabling ongoing screening will do a historic screening of all the existing bank names.',
        }),
      },
      required: ['fuzziness', 'screeningTypes'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { fuzziness, resolveIban, screeningTypes, ongoingScreening } =
      this.parameters

    if (_.isEmpty(screeningTypes) || !isBusinessUser(this.user)) {
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

    const ibanService = new IBANService(this.tenantId)

    if (resolveIban) {
      try {
        await ibanService.initialize()
        bankInfos = await ibanService.resolveBankName(bankInfos)
      } catch (e) {
        logger.error(e)
      }
    }
    const bankNames = _.uniq(
      bankInfos.map((bankInfo) => bankInfo.bankName).filter(Boolean) as string[]
    )

    const sanctionsService = new SanctionsService(this.tenantId)
    const hitResult: RuleHitResult = []
    const sanctionsDetails: SanctionsDetails[] = []
    for (const bankName of bankNames) {
      const result = await sanctionsService.search({
        searchTerm: bankName,
        types: screeningTypes,
        fuzziness: fuzziness / 100,
        monitoring: { enabled: ongoingScreening },
      })
      if (result.data && result.data.length > 0) {
        sanctionsDetails.push({
          name: bankName,
          searchId: result.searchId,
        })
      }
    }
    if (sanctionsDetails.length > 0) {
      hitResult.push({
        direction: 'ORIGIN',
        vars: this.getUserVars(),
        sanctionsDetails: _.uniqBy(sanctionsDetails, (details) => details.name),
      })
    }
    return hitResult
  }
}
