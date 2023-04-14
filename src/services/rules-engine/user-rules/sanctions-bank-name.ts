import { JSONSchemaType } from 'ajv'
import _ from 'lodash'
import {
  FUZZINESS_SCHEMA,
  SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA,
} from '../utils/rule-parameter-schemas'
import { isBusinessUser } from '../utils/user-rule-utils'
import { RuleHitResult } from '../rule'
import { UserRule } from './rule'
import { SanctionsSearchType } from '@/@types/openapi-internal/SanctionsSearchType'
import { SanctionsService } from '@/services/sanctions'
import { Business } from '@/@types/openapi-public/Business'
import { SanctionsDetails } from '@/@types/openapi-internal/SanctionsDetails'
import { IBANService } from '@/services/iban.com'

type BankInfo = { bankName?: string; iban?: string }

export type SanctionsBankUserRuleParameters = {
  resolveIban?: boolean
  screeningTypes?: SanctionsSearchType[]
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
        screeningTypes: SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA({}),
        fuzziness: FUZZINESS_SCHEMA,
      },
      required: ['fuzziness'],
      additionalProperties: false,
    }
  }

  public async computeRule() {
    const { fuzziness, resolveIban, screeningTypes } = this.parameters

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

    if (resolveIban) {
      bankInfos = await this.resolveBankName(bankInfos)
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
        monitoring: { enabled: true },
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

  private async resolveBankName(bankInfos: BankInfo[]): Promise<BankInfo[]> {
    const result: BankInfo[] = []
    const ibanService = new IBANService(this.tenantId)

    for (const bankInfo of bankInfos) {
      if (!bankInfo.bankName && bankInfo.iban) {
        const ibanDetails = await ibanService.validateIBAN(bankInfo.iban)
        result.push({ bankName: ibanDetails?.bankName, iban: bankInfo.iban })
      } else {
        result.push(bankInfo)
      }
    }
    return result
  }
}
