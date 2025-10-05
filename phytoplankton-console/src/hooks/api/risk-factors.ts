import { keyBy } from 'lodash';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import {
  RISK_FACTORS_V8,
  USER_DRS_VALUES,
  RISK_FACTOR_LOGIC,
  CUSTOM_RISK_FACTORS_ITEM,
  RISK_FACTOR_WORKFLOW_PROPOSAL_ITEM,
} from '@/utils/queries/keys';
import type { ExtendedDrsScore, RiskLevel, RiskFactor } from '@/apis';

export function useAllRiskFactorsMap() {
  const api = useApi();
  return useQuery(RISK_FACTORS_V8('ALL'), async () => {
    const data = await api.getAllRiskFactors({ includeV2: true });
    return keyBy(data, 'id');
  });
}

export function useUserDrsValuesPaginated(userId: string, params: Record<string, any>) {
  const api = useApi();
  return usePaginatedQuery<ExtendedDrsScore & { rowId?: string }>(
    USER_DRS_VALUES(userId, params),
    async (paginationParams) => {
      const result = await api.getDrsValues({
        userId,
        ...(params as any),
        ...paginationParams,
      });
      return {
        ...result,
        items: result.items.map((item) => ({ ...item, rowId: item.transactionId || '' })),
      };
    },
  );
}

export function useRiskFactorLogic(riskFactorId: string, versionId: string, riskLevel: RiskLevel) {
  const api = useApi();
  return useQuery(RISK_FACTOR_LOGIC(riskFactorId, versionId, riskLevel), async () => {
    const data = await api.riskFactorLogic({ riskFactorId, versionId, riskLevel });
    return data;
  });
}

export function useRiskFactors(type?: 'consumer' | 'business' | 'transaction') {
  const api = useApi();
  return useQuery<RiskFactor[]>(RISK_FACTORS_V8(type), async () => {
    const entityType =
      type === 'consumer'
        ? 'CONSUMER_USER'
        : type === 'business'
        ? 'BUSINESS'
        : type === 'transaction'
        ? 'TRANSACTION'
        : undefined;

    const result = await api.getAllRiskFactors({
      entityType: entityType as any,
      includeV2: true,
    });
    return result;
  });
}

export function useRiskFactor(
  scope: 'consumer' | 'business' | 'transaction',
  riskFactorId?: string,
) {
  const api = useApi();
  return useQuery<RiskFactor | null>(CUSTOM_RISK_FACTORS_ITEM(scope, riskFactorId), async () => {
    if (riskFactorId) {
      return await api.getRiskFactor({ riskFactorId });
    }
    return null;
  });
}

export function useRiskFactorPendingProposal(
  riskFactorId: string,
  options?: { enabled?: boolean },
) {
  const api = useApi();
  return useQuery(
    RISK_FACTOR_WORKFLOW_PROPOSAL_ITEM(riskFactorId ?? 'NEW'),
    async () => {
      if (!riskFactorId) {
        return null;
      }
      const proposals = await api.getPulseRiskFactorsWorkflowProposal({ riskFactorId });
      return proposals.find((x) => x.riskFactor.id === riskFactorId) ?? null;
    },
    { enabled: options?.enabled ?? true },
  );
}
