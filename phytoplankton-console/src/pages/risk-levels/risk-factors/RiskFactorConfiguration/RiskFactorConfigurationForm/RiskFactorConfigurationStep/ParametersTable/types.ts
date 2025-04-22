import {
  ParameterAttributeRiskValuesParameterTypeEnum,
  RiskEntityType,
  RiskParameterValue,
  ParameterAttributeRiskValuesTargetIterableParameterEnum,
  Feature,
  RiskScoreValueLevel,
  RiskScoreValueScore,
  RiskFactorParameter,
  RiskFactorDataType,
  RiskParameterValueLiteral,
  RiskParameterValueRange,
  RiskParameterValueMultiple,
  RiskParameterValueTimeRange,
  RiskParameterValueDayRange,
  RiskParameterValueAmountRange,
  RiskParameterLevelKeyValue,
} from '@/apis';

export type RiskValueContent = RiskParameterValue['content'];
export type RiskValueType = RiskValueContent['kind'];

export type RiskValueContentByType<T extends RiskValueType> = T extends 'LITERAL'
  ? RiskParameterValueLiteral
  : T extends 'RANGE'
  ? RiskParameterValueRange
  : T extends 'MULTIPLE'
  ? RiskParameterValueMultiple
  : T extends 'TIME_RANGE'
  ? RiskParameterValueTimeRange
  : T extends 'DAY_RANGE'
  ? RiskParameterValueDayRange
  : T extends 'AMOUNT_RANGE'
  ? RiskParameterValueAmountRange
  : never;

export interface RiskLevelTableItem {
  parameter: RiskFactorParameter;
  title: string;
  description: string;
  entity: RiskEntityType;
  isDerived: boolean;
  dataType: RiskFactorDataType;
  parameterType: ParameterAttributeRiskValuesParameterTypeEnum;
  targetIterableParameter?: ParameterAttributeRiskValuesTargetIterableParameterEnum;
  riskValue?: RiskScoreValueLevel | RiskScoreValueScore;
  isNullableAllowed?: boolean;
  defaultValue: RiskScoreValueLevel | RiskScoreValueScore;
  requiredFeatures?: Feature[];
  weight: number;
}

export type ParameterSettings = {
  isActive: boolean;
  values: RiskParameterLevelKeyValue[];
  defaultValue: RiskScoreValueLevel | RiskScoreValueScore;
  weight: number;
};
