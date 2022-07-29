import { ParameterAttributeRiskValuesParameterEnum, RiskParameterLevelKeyValue } from '@/apis';

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
  type: 'ENUMERATION' | 'RANGE';
  dataType: DataTypes;
}
export type RiskLevelTable = RiskLevelTableItem[];
export type DataTypes = 'STRING' | 'COUNTRY';
