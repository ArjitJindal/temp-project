import { getRiskLevelFromScore, getRiskScoreFromLevel } from '@flagright/lib/utils';
import { RiskClassificationScore } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { RISK_FACTORS_V8 } from '@/utils/queries/keys';

export const getSelectedRiskLevel = (x, riskClassificationValues: RiskClassificationScore[]) => {
  if (x == null) {
    return x;
  }
  if (typeof x === 'string') {
    return x;
  }
  return getRiskLevelFromScore(riskClassificationValues, x);
};

export const getSelectedRiskScore = (x, riskClassificationValues: RiskClassificationScore[]) => {
  if (x == null) {
    return x;
  }
  if (typeof x === 'number') {
    return x;
  }
  return getRiskScoreFromLevel(riskClassificationValues, x);
};

export function useRiskFactors(type?: 'consumer' | 'business' | 'transaction') {
  const api = useApi();

  const queryResult = useQuery(RISK_FACTORS_V8(type), async () => {
    const entityType =
      type === 'consumer'
        ? 'CONSUMER_USER'
        : type === 'business'
        ? 'BUSINESS'
        : type === 'transaction'
        ? 'TRANSACTION'
        : undefined;

    const result = await api.getAllRiskFactors({
      entityType: entityType,
      includeV2: true,
    });
    return result;
  });

  return queryResult;
}
