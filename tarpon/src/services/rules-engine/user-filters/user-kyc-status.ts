import { JSONSchemaType } from 'ajv'
import { USER_KYC_STATUS_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { UserRuleFilter } from './filter'
import { KYCStatus } from '@/@types/openapi-public/KYCStatus'

export type UserKycStatusRuleFilterParameter = {
  kycStatus?: KYCStatus[]
}

export class UserKycStatusRuleFilter extends UserRuleFilter<UserKycStatusRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserKycStatusRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        kycStatus: USER_KYC_STATUS_OPTIONAL_SCHEMA({
          description:
            'Add target KYC status to only run this rule for {{userAlias}}s with specified KYC status',
          uiSchema: {
            group: 'user',
          },
        }),
      },
    }
  }

  public async predicate(): Promise<boolean> {
    if (process.env.__INTERNAL_ENBALE_RULES_ENGINE_V8__) {
      return await this.v8Runner()
    }
    if (!this.parameters.kycStatus?.length) {
      return true
    }

    if (!this.user?.kycStatusDetails?.status) {
      return false
    }

    return this.parameters.kycStatus?.includes(
      this.user?.kycStatusDetails.status
    )
  }
}
