import {
  ParameterAttributeRiskValuesMatchTypeEnum,
  ParameterAttributeRiskValuesParameterEnum,
  ParameterAttributeRiskValuesParameterTypeEnum,
  RiskEntityType,
  ParameterAttributeRiskValuesRiskScoreTypeEnum,
  ParameterAttributeRiskValuesTargetIterableParameterEnum,
  RiskParameterLevelKeyValue,
  RiskParameterValue,
  RiskParameterValueLiteral,
  RiskParameterValueMultiple,
  RiskParameterValueRange,
} from '@/apis';

export type RiskValueContent = RiskParameterValue['content'];
export type RiskValueType = RiskValueContent['kind'];

export function riskValue(content: RiskValueContent): RiskParameterValue {
  return {
    content,
  };
}

export function riskValueLiteral(content: string | number | boolean): RiskParameterValueLiteral {
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

export function riskValueMultiple(values: RiskParameterValueLiteral[]): RiskParameterValueMultiple {
  return {
    kind: 'MULTIPLE',
    values,
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
  riskScoreType: ParameterAttributeRiskValuesRiskScoreTypeEnum;
  parameterType: ParameterAttributeRiskValuesParameterTypeEnum;
  matchType: ParameterAttributeRiskValuesMatchTypeEnum;
  targetIterableParameter?: ParameterAttributeRiskValuesTargetIterableParameterEnum;
}
export type RiskLevelTable = RiskLevelTableItem[];
export type DataType =
  | 'STRING'
  | 'RANGE'
  | 'COUNTRY'
  | 'CURRENCY'
  | 'PAYMENT_METHOD'
  | 'CONSUMER_USER_TYPE'
  | 'BUSINESS_USER_TYPE'
  | 'TRANSACTION_TYPES';
