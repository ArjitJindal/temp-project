import {
  ParameterAttributeRiskValuesParameterEnum,
  ParameterAttributeRiskValuesRiskValueTypeEnum,
  ParameterAttributeRiskValuesRiskEntityTypeEnum,
  RiskParameterLevelKeyValue,
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
}
export type RiskLevelTable = RiskLevelTableItem[];
export type DataTypes = 'STRING' | 'COUNTRY' | 'CURRENCY' | 'PAYMENT_METHOD';
