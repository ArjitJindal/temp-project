import { keyBy } from 'lodash';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { getOr } from '@/utils/asyncResource';
import {
  NEW_VERSION_ID,
  VERSION_HISTORY,
  VERSION_HISTORY_ITEM,
  RISK_CLASSIFICATION_VALUES,
  RISK_FACTORS_V8,
  USER_DRS_VALUES,
  RISK_FACTOR_LOGIC,
} from '@/utils/queries/keys';
import type {
  RiskClassificationConfig,
  RiskClassificationScore,
  RiskLevelAlias,
  VersionHistory,
  VersionHistoryRestorePayload,
  VersionHistoryType,
  ExtendedDrsScore,
  RiskLevel,
} from '@/apis';
import { message } from '@/components/library/Message';

export const DEFAULT_RISK_CLASSIFICATION_CONFIG: RiskClassificationConfig = {
  classificationValues: [],
  createdAt: 0,
  updatedAt: 0,
  id: '',
};

export function useRiskClassificationConfig(): {
  refetch: () => void;
  data: RiskClassificationConfig;
} {
  const api = useApi();
  const riskValuesQueryResults = useQuery(RISK_CLASSIFICATION_VALUES(), () =>
    api.getPulseRiskClassification(),
  );
  return {
    refetch: riskValuesQueryResults.refetch,
    data: getOr(riskValuesQueryResults.data, DEFAULT_RISK_CLASSIFICATION_CONFIG),
  };
}

export function useRiskClassificationScores(): Array<RiskClassificationScore> {
  const config = useRiskClassificationConfig();
  return config.data.classificationValues;
}

export function useRiskLevel(score?: number): RiskLevel | null {
  const config = useRiskClassificationConfig();
  if (score == null) {
    return null;
  }
  const values = config.data.classificationValues;
  for (const { lowerBoundRiskScore, upperBoundRiskScore, riskLevel } of values) {
    if (score >= lowerBoundRiskScore && score < upperBoundRiskScore) {
      return riskLevel as RiskLevel;
    }
  }
  return null;
}

export function useRiskScore(riskLevel: RiskLevel): number {
  const config = useRiskClassificationConfig();
  const values = config.data.classificationValues;
  for (const { lowerBoundRiskScore, upperBoundRiskScore, riskLevel: level } of values) {
    if (level === riskLevel) {
      return (lowerBoundRiskScore + upperBoundRiskScore) / 2;
    }
  }
  return 0;
}

export const levelToAlias = (level: string, configRiskLevelAlias: RiskLevelAlias[]) =>
  configRiskLevelAlias?.find((item) => item.level === level)?.alias || level;

// Risk factors
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

// Version history
export function useNewVersionId(type: VersionHistoryType) {
  const api = useApi();
  const queryResult = useQuery(NEW_VERSION_ID(type), () => api.getNewVersionId({ type }));
  return queryResult;
}

export function useVersionHistoryItem(type: VersionHistoryType, versionId: string) {
  const api = useApi();
  const navigate = useNavigate();
  const queryResult = useQuery<VersionHistory>(
    VERSION_HISTORY_ITEM(type, versionId ?? ''),
    () =>
      api.getVersionHistoryByVersionId({
        versionId: versionId ?? '',
      }),
    {
      enabled: !!versionId,
      onError: (error) => {
        message.fatal(`Version not found: ${error}`, {
          duration: 3,
        });
        navigate('/risk-levels/version-history');
      },
    },
  );
  return queryResult;
}

export function useMaxVersionIdRiskFactors() {
  const result = useNewVersionId('RiskFactors');
  return getOr(result.data, { id: '' }).id;
}

export function useVersionHistory(type: VersionHistoryType, params: any) {
  const api = useApi();
  return usePaginatedQuery(VERSION_HISTORY(type, params), async (pageParams) => {
    return await api.getVersionHistory({
      ...pageParams,
      page: pageParams.page || params.page,
      pageSize: pageParams.pageSize || params.pageSize,
      filterVersionId: params.id,
      filterCreatedBy: params.createdBy,
      filterAfterTimestamp: params.createdAt?.[0] ?? undefined,
      filterBeforeTimestamp: params.createdAt?.[1] ?? undefined,
      sortField: params?.sort?.[0]?.[0] ?? 'createdAt',
      sortOrder: params?.sort?.[0]?.[1] ?? 'descend',
      type,
    });
  });
}

export function useVersionHistoryRestore(onSuccess: () => void) {
  const api = useApi();
  const queryResult = useMutation<void, Error, VersionHistoryRestorePayload>(
    (data) => api.restoreVersionHistory({ VersionHistoryRestorePayload: data }),
    {
      onSuccess,
      onError: (error) => {
        message.fatal(`Version restore failed: ${error}`, { duration: 3 });
      },
    },
  );
  return queryResult;
}

// Risk classification mutation
export function usePostRiskClassification() {
  const api = useApi();
  return useMutation((payload: { scores: any; comment: string }) =>
    api.postPulseRiskClassification({
      RiskClassificationRequest: { scores: payload.scores, comment: payload.comment },
    }),
  );
}
