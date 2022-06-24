import { RiskLevel as ApiRiskLevel } from '@/apis';

export const RISK_LEVELS = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const;

export type RiskLevel = ApiRiskLevel;

export const RISK_LEVEL_LABELS: { [key in RiskLevel]: string } = {
  VERY_LOW: 'Very Low Risk',
  LOW: 'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH: 'High Risk',
  VERY_HIGH: 'Very High Risk',
} as const;

export const RISK_LEVEL_KEYS = Object.keys(RISK_LEVELS) as RiskLevel[];
