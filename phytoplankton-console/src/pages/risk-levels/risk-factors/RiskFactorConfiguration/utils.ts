import { DEFAULT_RISK_LEVEL } from '@flagright/lib/utils';
import { getSelectedRiskLevel, getSelectedRiskScore } from '../utils';
import { RiskFactorConfigurationStepFormValues } from './RiskFactorConfigurationForm/RiskFactorConfigurationStep';
import {
  RiskClassificationScore,
  RiskEntityType,
  RiskFactor,
  RiskFactorParameter,
  RiskFactorsPostRequest,
  RiskLevel,
} from '@/apis';

export interface BasicDetailsFormValues {
  name: string;
  description: string;
  defaultRiskValue: RiskLevel | number;
  defaultWeight: number;
  riskFactorId?: string;
}

export interface RiskFactorConfigurationFormValues {
  basicDetailsStep: BasicDetailsFormValues;
  riskFactorConfigurationStep: Partial<RiskFactorConfigurationStepFormValues>;
  v2Props?: {
    parameter: RiskFactorParameter;
    item: RiskFactor;
  };
}

export function deserializeRiskItem(riskItem: RiskFactor): RiskFactorConfigurationFormValues {
  const basicDetailsStep = {
    name: riskItem.name,
    description: riskItem.description,
    defaultWeight: riskItem.defaultWeight,
    defaultRiskValue: riskItem.defaultRiskScore ?? DEFAULT_RISK_LEVEL,
  };
  const riskFactorConfigurationStep = {
    baseCurrency: riskItem.baseCurrency,
    aggregationVariables: riskItem.logicAggregationVariables,
    riskLevelLogic: riskItem.riskLevelLogic,
    entityVariables: riskItem.logicEntityVariables,
  };
  if (riskItem.parameter) {
    return {
      basicDetailsStep: basicDetailsStep as BasicDetailsFormValues,
      riskFactorConfigurationStep: riskFactorConfigurationStep,
      v2Props: {
        parameter: riskItem.parameter as RiskFactorParameter,
        item: riskItem,
      },
    };
  }
  return {
    basicDetailsStep: basicDetailsStep as BasicDetailsFormValues,
    riskFactorConfigurationStep,
  };
}

type RiskFactorType = 'consumer' | 'business' | 'transaction';

export function serializeRiskItem(
  riskFactorFormValues: RiskFactorConfigurationFormValues,
  type: RiskFactorType,
  riskClassificationValues: RiskClassificationScore[],
  riskFactorId?: string,
  v2Props?: {
    parameter: RiskFactorParameter;
    item: RiskFactor;
  },
): RiskFactorsPostRequest {
  const TYPE_MAP: Readonly<Record<RiskFactorType, RiskEntityType>> = {
    consumer: 'CONSUMER_USER',
    business: 'BUSINESS',
    transaction: 'TRANSACTION',
  };

  const baseRequest = {
    name: riskFactorFormValues.basicDetailsStep.name ?? '',
    description: riskFactorFormValues.basicDetailsStep.description ?? '',
    status: 'ACTIVE',
    defaultWeight: riskFactorFormValues.basicDetailsStep.defaultWeight ?? 1,
    baseCurrency: riskFactorFormValues.riskFactorConfigurationStep.baseCurrency,
    defaultRiskScore: getSelectedRiskScore(
      riskFactorFormValues.basicDetailsStep.defaultRiskValue,
      riskClassificationValues,
    ),
    defaultRiskLevel: getSelectedRiskLevel(
      riskFactorFormValues.basicDetailsStep.defaultRiskValue,
      riskClassificationValues,
    ),
    riskLevelLogic: riskFactorFormValues.riskFactorConfigurationStep.riskLevelLogic ?? [],
    logicAggregationVariables:
      riskFactorFormValues.riskFactorConfigurationStep.aggregationVariables ?? [],
    logicEntityVariables: riskFactorFormValues.riskFactorConfigurationStep.entityVariables ?? [],
    type: TYPE_MAP[type],
    riskFactorId,
  } as RiskFactorsPostRequest;
  if (v2Props) {
    return {
      ...baseRequest,
      parameter: v2Props.parameter,
      dataType: v2Props.item.dataType,
      valueType: v2Props.item.valueType,
      riskLevelAssignmentValues: v2Props.item.riskLevelAssignmentValues,
    } as RiskFactorsPostRequest;
  }
  return baseRequest;
}
