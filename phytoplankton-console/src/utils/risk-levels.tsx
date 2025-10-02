import {
  RiskLevel as ApiRiskLevel,
  RiskClassificationConfig,
  RiskClassificationScore,
  RiskLevelAlias,
} from '@/apis';
import {
  COLORS_V2_GRAY_10,
  COLORS_V2_RISK_LEVEL_BASE_HIGH,
  COLORS_V2_RISK_LEVEL_BASE_LOW,
  COLORS_V2_RISK_LEVEL_BASE_MEDIUM,
  COLORS_V2_RISK_LEVEL_BASE_VERY_HIGH,
  COLORS_V2_RISK_LEVEL_BASE_VERY_LOW,
  COLORS_V2_RISK_LEVEL_BG_HIGH,
  COLORS_V2_RISK_LEVEL_BG_LOW,
  COLORS_V2_RISK_LEVEL_BG_MEDIUM,
  COLORS_V2_RISK_LEVEL_BG_VERY_HIGH,
  COLORS_V2_RISK_LEVEL_BG_VERY_LOW,
} from '@/components/ui/colors';
import { useRiskClassificationConfig } from '@/hooks/api';

export const RISK_LEVELS: ApiRiskLevel[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

export type RiskLevel = ApiRiskLevel;

export const DEFAULT_RISK_CLASSIFICATION_CONFIG: RiskClassificationConfig = {
  classificationValues: [],
  createdAt: 0,
  updatedAt: 0,
  id: '',
};

export const RISK_LEVEL_LABELS: { [key in RiskLevel]: string } = Object.freeze({
  VERY_LOW: 'Very low risk',
  LOW: 'Low risk',
  MEDIUM: 'Medium risk',
  HIGH: 'High risk',
  VERY_HIGH: 'Very high risk',
});

type RiskLevelColors = {
  primary?: string;
  light?: string;
  text?: string;
};

export const RISK_LEVEL_COLORS: { [key in RiskLevel]: RiskLevelColors } = Object.freeze({
  VERY_LOW: {
    primary: COLORS_V2_RISK_LEVEL_BASE_VERY_LOW,
    light: COLORS_V2_RISK_LEVEL_BG_VERY_LOW,
    text: COLORS_V2_GRAY_10,
  },
  LOW: {
    primary: COLORS_V2_RISK_LEVEL_BASE_LOW,
    light: COLORS_V2_RISK_LEVEL_BG_LOW,
    text: COLORS_V2_GRAY_10,
  },
  MEDIUM: {
    primary: COLORS_V2_RISK_LEVEL_BASE_MEDIUM,
    light: COLORS_V2_RISK_LEVEL_BG_MEDIUM,
    text: COLORS_V2_GRAY_10,
  },
  HIGH: {
    primary: COLORS_V2_RISK_LEVEL_BASE_HIGH,
    light: COLORS_V2_RISK_LEVEL_BG_HIGH,
    text: COLORS_V2_GRAY_10,
  },
  VERY_HIGH: {
    primary: COLORS_V2_RISK_LEVEL_BASE_VERY_HIGH,
    light: COLORS_V2_RISK_LEVEL_BG_VERY_HIGH,
    text: COLORS_V2_GRAY_10,
  },
});

export { useRiskClassificationConfig };

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
      return riskLevel;
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
