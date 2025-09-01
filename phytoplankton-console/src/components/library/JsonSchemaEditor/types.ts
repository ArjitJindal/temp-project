import { JSONSchema4 } from 'json-schema';
import { TransactionsUniquesField } from '@/apis';

export interface UiSchemaCommon {
  'ui:group'?: string;
  'ui:entityName'?: string;
  'ui:order'?: [string];
  'ui:hidden'?: boolean;
  'ui:readOnly'?: boolean;
  'ui:width'?: 'FULL' | 'HALF';
  'ui:uniqueType'?: TransactionsUniquesField;
}

export interface UiSchemaUnknown extends UiSchemaCommon {
  'ui:subtype'?: undefined;
}

export interface UiSchemaTextarea extends UiSchemaCommon {
  'ui:subtype': 'TEXTAREA';
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

export interface UiSchemaCountryRegion extends UiSchemaCommon {
  'ui:subtype': 'COUNTRY_REGION';
  'ui:countryField'?: string;
}

export interface UiSchemaCountry extends UiSchemaCommon {
  'ui:subtype': 'COUNTRY';
}

export interface UiSchemaAgeRange extends UiSchemaCommon {
  'ui:subtype': 'AGE_RANGE';
  'ui:defaultGranularity': 'day' | 'month' | 'year';
}

export interface UiSchemaNumberSlider extends UiSchemaCommon {
  'ui:subtype': 'NUMBER_SLIDER_RANGE' | 'NUMBER_SLIDER_SINGLE';
  'ui:minimum': number;
  'ui:maximum': number;
  'ui:multipleOf'?: number;
}

export interface UiSchemaTransactionAmountRange extends UiSchemaCommon {
  'ui:subtype': 'TRANSACTION_AMOUNT_RANGE';
}

export interface UiSchemaTransactionTimeRange extends UiSchemaCommon {
  'ui:subtype': 'TIME_RANGE';
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

export interface UiSchemaFreeTextEnum extends UiSchemaCommon {
  'ui:subtype': 'FREE_TEXT_ENUM';
}

export interface UiSchemaKeyValuePair extends UiSchemaCommon {
  'ui:subtype': 'KEY_VALUE_PAIR';
}

export interface UiSchemaCurrency extends UiSchemaCommon {
  'ui:subtype': 'CURRENCY';
}

export interface UiSchemaNarrative extends UiSchemaCommon {
  'ui:subtype': 'NARRATIVE';
}

export interface UiSchemaMarkdown extends UiSchemaCommon {
  'ui:subtype': 'MARKDOWN';
}

export interface UiSchemaFincenIndicator extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_INDICATOR';
}

export interface UiSchemaFincenSubject extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_SUBJECT';
}

export interface UiSchemaFincenPartyName extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_PARTY_NAME';
}
export interface UiSchemaFincenSuspiciousActivity extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_SUSPICIOUS_ACTIVITY';
}

export interface UiSchemaFincenPhoneNumber extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_PHONE_NUMBER';
}

export interface UiSchemaElectronicAddress extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS';
}

export interface UiSchemaList extends UiSchemaCommon {
  'ui:subtype': 'WHITELIST' | 'BLACKLIST';
}

export interface UiSchemaGenericSanctionsScreeningTypes extends UiSchemaCommon {
  'ui:subtype': 'GENERIC_SANCTIONS_SCREENING_TYPES';
}

export interface UiSchemaFuzzinessSettings extends UiSchemaCommon {
  'ui:subtype': 'FUZZINESS_SETTINGS';
}

export interface UiSchemaFincenGender extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_GENDER';
  'ui:maleIndicatorField'?: string;
  'ui:femaleIndicatorField'?: string;
  'ui:unknownIndicatorField'?: string;
}

export interface UiSchemaFincenNumber extends UiSchemaCommon {
  'ui:subtype': 'FINCEN_NUMBER';
  'ui:maxDigits'?: number;
  'ui:zeroPadLeft'?: boolean;
  'ui:allowNegatives'?: boolean;
}

export interface UiSchemaWebhook extends UiSchemaCommon {
  'ui:subtype': 'WEBHOOK';
}

export interface UiSchemaTransactionTypes extends UiSchemaCommon {
  'ui:subtype': 'TRANSACTION_TYPES';
}

export interface UiSchemaTransactionType extends UiSchemaCommon {
  'ui:subtype': 'TRANSACTION_TYPE';
}
export interface UiSchemaScreeningProfileId extends UiSchemaCommon {
  'ui:subtype': 'SCREENING_PROFILE_ID';
}

export type UiSchema =
  | UiSchemaUnknown
  | UiSchemaTextarea
  | UiSchemaDayWindow
  | UiSchemaTimeWindow
  | UiSchemaCountries
  | UiSchemaCountry
  | UiSchemaCountryRegion
  | UiSchemaAgeRange
  | UiSchemaTransactionAmountRange
  | UiSchemaTransactionAmountThresholds
  | UiSchemaPaymentChannel
  | UiSchemaUserType
  | UiSchemaCurrency
  | UiSchemaPaymentFilters
  | UiSchemaNarrative
  | UiSchemaMarkdown
  | UiSchemaTransactionTimeRange
  | UiSchemaChecklistsCategoryList
  | UiSchemaFincenIndicator
  | UiSchemaFincenSubject
  | UiSchemaFincenPartyName
  | UiSchemaFincenSuspiciousActivity
  | UiSchemaFincenPhoneNumber
  | UiSchemaElectronicAddress
  | UiSchemaFincenGender
  | UiSchemaFincenNumber
  | UiSchemaWebhook
  | UiSchemaList
  | UiSchemaNumberSlider
  | UiSchemaGenericSanctionsScreeningTypes
  | UiSchemaFuzzinessSettings
  | UiSchemaFreeTextEnum
  | UiSchemaKeyValuePair
  | UiSchemaTransactionType
  | UiSchemaTransactionTypes
  | UiSchemaScreeningProfileId;

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
