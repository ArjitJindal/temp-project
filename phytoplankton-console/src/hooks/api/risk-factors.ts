import { keyBy } from 'lodash';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import {
  RISK_FACTORS_V8,
  USER_DRS_VALUES,
  RISK_FACTOR_LOGIC,
  CUSTOM_RISK_FACTORS_ITEM,
  RISK_FACTOR_WORKFLOW_PROPOSAL_ITEM,
  RISK_CLASSIFICATION_WORKFLOW_PROPOSAL,
  SIMULATION_JOB_ITERATION_RESULT,
} from '@/utils/queries/keys';
import type {
  RiskLevel,
  RiskClassificationConfigApproval,
  SimulationRiskLevelsAndRiskFactorsResult,
} from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export function useAllRiskFactorsMap() {
  const api = useApi();
  return useQuery(RISK_FACTORS_V8('ALL'), async () => {
    const data = await api.getAllRiskFactors({ includeV2: true });
    return keyBy(data, 'id');
  });
}

export function useUserDrsValuesPaginated(userId: string, params: Record<string, any>) {
  const api = useApi();
  return usePaginatedQuery(USER_DRS_VALUES(userId, params), async (paginationParams) => {
    const result = await api.getDrsValues({
      userId,
      ...(params as Record<string, any>),
      ...paginationParams,
    });
    return {
      ...result,
      items: result.items.map((item) => ({ ...item, rowId: item.transactionId || '' })),
    };
  });
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
  return useQuery(RISK_FACTORS_V8(type), async () => {
    const entityType =
      type === 'consumer'
        ? 'CONSUMER_USER'
        : type === 'business'
        ? 'BUSINESS'
        : type === 'transaction'
        ? 'TRANSACTION'
        : undefined;

    const result = await api.getAllRiskFactors({
      entityType: entityType as 'CONSUMER_USER' | 'BUSINESS' | 'TRANSACTION' | undefined,
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
  return useQuery(CUSTOM_RISK_FACTORS_ITEM(scope, riskFactorId), async () => {
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

export function usePendingProposal() {
  const api = useApi();
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  return useQuery<RiskClassificationConfigApproval | null>(
    RISK_CLASSIFICATION_WORKFLOW_PROPOSAL(),
    async () => {
      return await api.getPulseRiskClassificationWorkflowProposal();
    },
    { enabled: isApprovalWorkflowsEnabled },
  );
}

export function useSimulationIterationResults(iteration: any, params: any) {
  const api = useApi();
  return usePaginatedQuery(
    SIMULATION_JOB_ITERATION_RESULT(iteration?.taskId ?? '', params),
    async (paginationParams) => {
      if (iteration?.taskId) {
        const response = await api.getSimulationTaskIdResult({
          taskId: iteration.taskId,
          page: paginationParams.page,
          pageSize: paginationParams.pageSize,
          sortField: params.sort?.[0]?.[0] ?? 'userId',
          sortOrder: params.sort?.[0]?.[1] ?? 'ascend',
        });
        return {
          items: response.items as SimulationRiskLevelsAndRiskFactorsResult[],
          total: response.total,
        };
      }
      return { items: [], total: 0 };
    },
  );
}

export function useRiskFactorsSimulationResults(iteration: any, params: any) {
  const api = useApi();
  return usePaginatedQuery(
    SIMULATION_JOB_ITERATION_RESULT(iteration?.taskId ?? '', {
      ...params,
      progress: iteration.progress,
    }),
    async (paginationParams) => {
      if (iteration?.taskId) {
        const response = await api.getSimulationTaskIdResult({
          taskId: iteration.taskId,
          page: paginationParams.page ?? params.page,
          pageSize: paginationParams.pageSize ?? params.pageSize,
          sortField: params.sort?.[0]?.[0] ?? 'userId',
          sortOrder: params.sort?.[0]?.[1] ?? 'ascend',
          filterCurrentKrsLevel: params['current.krs.riskLevel'],
          filterSimulationKrsLevel: params['simulated.krs.riskLevel'],
          filterCurrentDrsLevel: params['current.drs.riskLevel'],
          filterSimulationDrsLevel: params['simulated.drs.riskLevel'],
          filterUserId: params.userId,
        });

        return {
          items: response.items as SimulationRiskLevelsAndRiskFactorsResult[],
          total: response.total,
        };
      } else {
        return {
          items: [] as SimulationRiskLevelsAndRiskFactorsResult[],
          total: 0,
        };
      }
    },
  );
}
