import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { getOr } from '@/utils/asyncResource';
import { RISK_CLASSIFICATION_VALUES } from '@/utils/queries/keys';
import {
  RiskClassificationConfig,
  RiskClassificationScore,
  RiskLevel as ApiRiskLevel,
  RiskLevelAlias,
} from '@/apis';

export type RiskLevel = ApiRiskLevel;

export const DEFAULT_RISK_CLASSIFICATION_CONFIG: RiskClassificationConfig = {
  classificationValues: [],
  createdAt: 0,
  updatedAt: 0,
  id: '',
};

export function useRiskClassificationConfig(): {
  refetch: () => void;
  data: RiskClassificationConfig;
} {
  const api = useApi();
  const riskValuesQueryResults = useQuery(RISK_CLASSIFICATION_VALUES(), () =>
    api.getPulseRiskClassification(),
  );
  return {
    refetch: riskValuesQueryResults.refetch,
    data: getOr(riskValuesQueryResults.data, DEFAULT_RISK_CLASSIFICATION_CONFIG),
  };
}

export function useRiskClassificationScores(): Array<RiskClassificationScore> {
  const config = useRiskClassificationConfig();
  return config.data.classificationValues;
}

export function useRiskLevel(score?: number): RiskLevel | null {
  const config = useRiskClassificationConfig();
  if (score == null) {
    return null;
  }
  const values = config.data.classificationValues;
  for (const { lowerBoundRiskScore, upperBoundRiskScore, riskLevel } of values) {
    if (score >= lowerBoundRiskScore && score < upperBoundRiskScore) {
      return riskLevel as RiskLevel;
    }
  }
  return null;
}

export function useRiskScore(riskLevel: RiskLevel): number {
  const config = useRiskClassificationConfig();
  const values = config.data.classificationValues;
  for (const { lowerBoundRiskScore, upperBoundRiskScore, riskLevel: level } of values) {
    if (level === riskLevel) {
      return (lowerBoundRiskScore + upperBoundRiskScore) / 2;
    }
  }
  return 0;
}

export const levelToAlias = (level: string, configRiskLevelAlias: RiskLevelAlias[]) =>
  configRiskLevelAlias?.find((item) => item.level === level)?.alias || level;
