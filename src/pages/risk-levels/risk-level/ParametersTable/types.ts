import {
  ParameterAttributeRiskValuesParameterEnum,
  ParameterAttributeRiskValuesParameterTypeEnum,
  RiskEntityType,
  ParameterAttributeRiskValuesTargetIterableParameterEnum,
  RiskParameterLevelKeyValue,
  RiskParameterValue,
  RiskParameterValueLiteral,
  RiskParameterValueMultiple,
  RiskParameterValueRange,
  RiskLevel,
  RiskParameterValueTimeRange,
  RiskParameterValueDayRange,
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

export function riskValueDayRange(start: number, end: number): RiskParameterValueDayRange {
  return {
    kind: 'DAY_RANGE',
    start,
    end,
  };
}

export function riskValueMultiple(values: RiskParameterValueLiteral[]): RiskParameterValueMultiple {
  return {
    kind: 'MULTIPLE',
    values,
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

export type ParameterName = ParameterAttributeRiskValuesParameterEnum;
export type Entity = RiskEntityType;
export type ParameterValues = RiskParameterLevelKeyValue[];
export type ParameterSettings = {
  isActive: boolean;
  values: ParameterValues;
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
  risklevel?: RiskLevel;
  isNullableAllowed?: boolean;
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
  | 'BOOLEAN';
