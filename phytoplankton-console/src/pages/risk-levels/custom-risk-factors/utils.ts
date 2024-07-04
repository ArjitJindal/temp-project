import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import { RiskClassificationScore } from '@/apis';

export const getSelectedRiskLevel = (x, riskClassificationValues: RiskClassificationScore[]) => {
  if (!x) {
    return x;
  }
  if (typeof x === 'string') {
    return x;
  }
  return getRiskLevelFromScore(riskClassificationValues, x);
};

export const getSelectedRiskScore = (x, riskClassificationValues: RiskClassificationScore[]) => {
  if (!x) {
    return x;
  }
  if (typeof x === 'number') {
    return x;
  }
  return getRiskScoreFromLevel(riskClassificationValues, x);
};
