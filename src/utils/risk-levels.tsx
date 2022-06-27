import { red, green, orange } from '@ant-design/colors';
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

type RiskLevelColors = {
  primary?: string;
  light?: string;
};

export const RISK_LEVEL_COLORS: { [key in RiskLevel]: RiskLevelColors } = {
  VERY_LOW: { primary: green.primary, light: green[0] },
  LOW: { primary: green.primary, light: green[0] },
  MEDIUM: { primary: orange.primary, light: orange[0] },
  HIGH: { primary: red.primary, light: red[0] },
  VERY_HIGH: { primary: red.primary, light: red[0] },
} as const;
