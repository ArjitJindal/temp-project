import {
  ParameterAttributeRiskValuesParameterEnum,
  ParameterAttributeRiskValuesRiskValueTypeEnum,
  ParameterAttributeRiskValuesRiskEntityTypeEnum,
  RiskParameterLevelKeyValue,
  ParameterAttributeRiskValuesParameterTypeEnum,
  ParameterAttributeRiskValuesTargetIterableParameterEnum,
  ParameterAttributeRiskValuesMatchTypeEnum,
} from '@/apis';

export type ParameterName = ParameterAttributeRiskValuesParameterEnum;
export type ParameterValues = RiskParameterLevelKeyValue[];
export type ParameterSettings = {
  isActive: boolean;
  values: ParameterValues;
};

export interface RiskLevelTableItem {
  parameter: ParameterName;
  title: string;
  description: string;
  type: ParameterAttributeRiskValuesRiskValueTypeEnum;
  entity: ParameterAttributeRiskValuesRiskEntityTypeEnum;
  isDerived: boolean;
  dataType: DataTypes;
  parameterType: ParameterAttributeRiskValuesParameterTypeEnum;
  matchType: ParameterAttributeRiskValuesMatchTypeEnum;
  targetIterableParameter?: ParameterAttributeRiskValuesTargetIterableParameterEnum;
}
export type RiskLevelTable = RiskLevelTableItem[];
export type DataTypes =
  | 'STRING'
  | 'COUNTRY'
  | 'CURRENCY'
  | 'PAYMENT_METHOD'
  | 'CONSUMER_USER_TYPE'
  | 'BUSINESS_USER_TYPE'
  | 'BUSINESS_REGISTRATION_COUNTRY';
