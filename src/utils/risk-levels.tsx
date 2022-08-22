import { RiskLevel as ApiRiskLevel } from '@/apis';
import COLORS from '@/components/ui/colors';

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
  VERY_LOW: { primary: COLORS.brandBlue.base, light: COLORS.brandBlue.tint },
  LOW: { primary: COLORS.successColor.base, light: COLORS.successColor.tint },
  MEDIUM: { primary: COLORS.warningColor.base, light: COLORS.warningColor.tint },
  HIGH: { primary: COLORS.errorColor.base, light: COLORS.errorColor.tint },
  VERY_HIGH: { primary: COLORS.errorColor.base, light: COLORS.errorColor.tint },
} as const;
