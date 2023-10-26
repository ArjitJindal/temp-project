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

export interface UiSchemaCountry extends UiSchemaCommon {
  'ui:subtype': 'COUNTRY';
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
  'ui:subtype': 'PAYMENT_CHANNELS';
}

export interface UiSchemaChecklistsCategoryList extends UiSchemaCommon {
  'ui:subtype': 'CHECKLISTS_CATEGORY_LIST';
}

export interface UiSchemaPaymentFilters extends UiSchemaCommon {
  'ui:subtype': 'PAYMENT_FILTERS';
}

export interface UiSchemaUserType extends UiSchemaCommon {
  'ui:subtype': 'USER_TYPE';
}

export interface UiSchemaCurrency extends UiSchemaCommon {
  'ui:subtype': 'CURRENCY';
}

export interface UiSchemaFincenIndicator extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_INDICATOR';
}

export interface UiSchemaNarrative extends UiSchemaCommon {
  'ui:subtype': 'NARRATIVE';
}

export interface UiSchemaUnknown extends UiSchemaCommon {
  'ui:subtype'?: undefined;
}

export type UiSchema =
  | UiSchemaDayWindow
  | UiSchemaTimeWindow
  | UiSchemaCountries
  | UiSchemaCountry
  | UiSchemaFincenIndicator
  | UiSchemaAgeRange
  | UiSchemaTransactionAmountRange
  | UiSchemaTransactionAmountThresholds
  | UiSchemaPaymentChannel
  | UiSchemaUserType
  | UiSchemaCurrency
  | UiSchemaPaymentFilters
  | UiSchemaUnknown
  | UiSchemaNarrative
  | UiSchemaChecklistsCategoryList;

export interface ExtendedSchema extends JSONSchema4 {
  'ui:schema'?: UiSchema;
  items?: ExtendedSchema;
}

// todo: fix any?
export type FormValues = Record<string, any>;

export type PropertyItem = {
  name: string;
  isRequired: boolean;
  schema: ExtendedSchema;
};
export type PropertyItems = PropertyItem[];
