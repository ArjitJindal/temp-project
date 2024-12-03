import {
  ParameterAttributeRiskValuesParameterTypeEnum,
  RiskEntityType,
  ParameterAttributeRiskValuesTargetIterableParameterEnum,
  RiskParameterLevelKeyValue,
  RiskParameterValue,
  RiskParameterValueLiteral,
  RiskParameterValueMultiple,
  RiskParameterValueRange,
  RiskParameterValueTimeRange,
  RiskParameterValueDayRange,
  RiskParameterValueAmountRange,
  CurrencyCode,
  Feature,
  RiskScoreValueLevel,
  RiskScoreValueScore,
  RiskFactorParameter,
} from '@/apis';

export type RiskValueContent = RiskParameterValue['content'];
export type RiskValueType = RiskValueContent['kind'];

export function riskValue(content: RiskValueContent): RiskParameterValue {
  return {
    content,
  };
}

export function riskValueLiteral(
  content: string | number | boolean | undefined,
): RiskParameterValueLiteral {
  return {
    kind: 'LITERAL',
    content,
  };
}

export function riskValueRange(start: number, end: number): RiskParameterValueRange {
  return {
    kind: 'RANGE',
    start,
    end,
  };
}

export function riskValueDayRange(
  start: number,
  startGranularity: RiskParameterValueDayRange['startGranularity'],
  end: number,
  endGranularity: RiskParameterValueDayRange['endGranularity'],
): RiskParameterValueDayRange {
  return {
    kind: 'DAY_RANGE',
    start,
    end,
    endGranularity,
    startGranularity,
  };
}

export function riskValueMultiple(values: RiskParameterValueLiteral[]): RiskParameterValueMultiple {
  return {
    kind: 'MULTIPLE',
    values,
  };
}

export function riskValueAmountRange(
  start: number,
  end: number,
  currency: CurrencyCode,
): RiskParameterValueAmountRange {
  return {
    kind: 'AMOUNT_RANGE',
    start,
    end,
    currency,
  };
}

export function riskValueTimeRange(
  startHour: number,
  endHour: number,
  timezone: string,
): RiskParameterValueTimeRange {
  return {
    kind: 'TIME_RANGE',
    startHour,
    endHour,
    timezone,
  };
}

export type ParameterName = RiskFactorParameter;
export type Entity = RiskEntityType;
export type ParameterValues = RiskParameterLevelKeyValue[];
export type ParameterValueContent = RiskParameterValue['content'];
export type ParameterSettings = {
  isActive: boolean;
  values: ParameterValues;
  defaultValue: RiskScoreValueLevel | RiskScoreValueScore;
  weight: number;
};

export interface RiskLevelTableItem {
  parameter: ParameterName;
  title: string;
  description: string;
  entity: RiskEntityType;
  isDerived: boolean;
  dataType: DataType;
  parameterType: ParameterAttributeRiskValuesParameterTypeEnum;
  targetIterableParameter?: ParameterAttributeRiskValuesTargetIterableParameterEnum;
  riskValue?: RiskScoreValueLevel | RiskScoreValueScore;
  isNullableAllowed?: boolean;
  defaultValue: RiskScoreValueLevel | RiskScoreValueScore;
  requiredFeatures?: Feature[];
  weight: number;
}

export type RiskLevelTable = RiskLevelTableItem[];
export type DataType =
  | 'STRING'
  | 'RANGE'
  | 'DAY_RANGE'
  | 'COUNTRY'
  | 'CURRENCY'
  | 'PAYMENT_METHOD'
  | 'CONSUMER_USER_TYPE'
  | 'BUSINESS_USER_TYPE'
  | 'TRANSACTION_TYPES'
  | 'RESIDENCE_TYPES'
  | 'TIME_RANGE'
  | 'BUSINESS_INDUSTRY'
  | 'BOOLEAN'
  | 'BUSINESS_USER_SEGMENT'
  | 'CONSUMER_USER_SEGMENT'
  | 'CONSUMER_EMPLOYMENT_STATUS'
  | 'USER_REGISTRATION_STATUS'
  | 'BANK_NAMES'
  | '_3DS_STATUS'
  | 'SOURCE_OF_FUNDS'
  | 'AMOUNT_RANGE';
