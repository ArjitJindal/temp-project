import { JSONSchemaType } from 'ajv'
import { ACQUISITION_CHANNEL_OPTIONAL_SCHEMA } from '../utils/rule-parameter-schemas'
import { UserRuleFilter } from './filter'
import { AcquisitionChannel } from '@/@types/openapi-internal/AcquisitionChannel'

export type UserAcquisitionChannelRuleFilterParameter = {
  acquisitionChannels?: AcquisitionChannel[]
}

export class UserAcquisitionChannelRuleFilter extends UserRuleFilter<UserAcquisitionChannelRuleFilterParameter> {
  public static getSchema(): JSONSchemaType<UserAcquisitionChannelRuleFilterParameter> {
    return {
      type: 'object',
      properties: {
        acquisitionChannels: ACQUISITION_CHANNEL_OPTIONAL_SCHEMA({
          title: 'Acquisition channels',
          description:
            'Add target acquisition channels to only run this rule for certain {{userAlias}}s',
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
    if (!this.parameters.acquisitionChannels?.length) {
      return true
    }

    if (!this.user?.acquisitionChannel) {
      return false
    }

    return this.parameters.acquisitionChannels?.includes(
      this.user?.acquisitionChannel
    )
  }
}
