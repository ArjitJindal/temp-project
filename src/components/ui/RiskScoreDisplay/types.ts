import { RiskLevel } from '@/utils/risk-levels';
import { RiskScoreComponent } from '@/apis';

export interface ValueItem {
  createdAt: number;
  value: number;
  riskLevel?: RiskLevel;
  components?: Array<RiskScoreComponent>;
}
