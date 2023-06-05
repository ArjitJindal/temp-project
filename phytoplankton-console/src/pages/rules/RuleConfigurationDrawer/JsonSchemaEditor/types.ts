import { JSONSchema4 } from 'json-schema';

export interface UiSchemaCommon {
  'ui:group'?: string;
  'ui:entityName'?: string;
  'ui:order'?: [string];
}

export interface UiSchemaDayWindow extends UiSchemaCommon {
  'ui:subtype': 'DAY_WINDOW';
}

export interface UiSchemaTimeWindow extends UiSchemaCommon {
  'ui:subtype': 'TIME_WINDOW';
}

export interface UiSchemaCountries extends UiSchemaCommon {
  'ui:subtype': 'COUNTRIES';
}

export interface UiSchemaAgeRange extends UiSchemaCommon {
  'ui:subtype': 'AGE_RANGE';
  'ui:defaultGranularity': 'day' | 'month' | 'year';
}

export interface UiSchemaTransactionAmountRange extends UiSchemaCommon {
  'ui:subtype': 'TRANSACTION_AMOUNT_RANGE';
}

export interface UiSchemaTransactionAmountThresholds extends UiSchemaCommon {
  'ui:subtype': 'TRANSACTION_AMOUNT_THRESHOLDS';
}

export interface UiSchemaPaymentChannel extends UiSchemaCommon {
  'ui:subtype': 'PAYMENT_CHANNEL';
}

export interface UiSchemaUserType extends UiSchemaCommon {
  'ui:subtype': 'USER_TYPE';
}

export interface UiSchemaCurrency extends UiSchemaCommon {
  'ui:subtype': 'CURRENCY';
}

export interface UiSchemaUnknown extends UiSchemaCommon {
  'ui:subtype'?: undefined;
}

export type UiSchema =
  | UiSchemaDayWindow
  | UiSchemaTimeWindow
  | UiSchemaCountries
  | UiSchemaAgeRange
  | UiSchemaTransactionAmountRange
  | UiSchemaTransactionAmountThresholds
  | UiSchemaPaymentChannel
  | UiSchemaUserType
  | UiSchemaCurrency
  | UiSchemaUnknown;

export interface ExtendedSchema extends JSONSchema4 {
  'ui:schema'?: UiSchema;
}

// todo: fix any?
export type FormValues = Record<string, any>;

export type PropertyItem = {
  name: string;
  isRequired: boolean;
  schema: ExtendedSchema;
};
export type PropertyItems = PropertyItem[];
