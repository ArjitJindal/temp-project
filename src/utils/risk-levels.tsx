import { RiskLevel as ApiRiskLevel } from '@/apis';
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

export const RISK_LEVELS: ApiRiskLevel[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

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
  text?: string;
};

export const RISK_LEVEL_COLORS: { [key in RiskLevel]: RiskLevelColors } = {
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
} as const;
