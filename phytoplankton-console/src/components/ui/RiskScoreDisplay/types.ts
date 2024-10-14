import { RiskFactorScoreDetails, RiskScoreComponent } from '@/apis';
import { RiskLevel } from '@/utils/risk-levels';

export interface ValueItem {
  score: number;
  createdAt: number;
  manualRiskLevel?: RiskLevel;
  components?: Array<RiskScoreComponent>;
  factorScoreDetails?: Array<RiskFactorScoreDetails>;
  transactionId?: string;
}
