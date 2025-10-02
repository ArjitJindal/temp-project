import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { NEW_VERSION_ID, VERSION_HISTORY, VERSION_HISTORY_ITEM } from '@/utils/queries/keys';
import { VersionHistory, VersionHistoryRestorePayload, VersionHistoryType } from '@/apis';
import { message } from '@/components/library/Message';

export function useNewVersionId(type: VersionHistoryType) {
  const api = useApi();
  const queryResult = useQuery(NEW_VERSION_ID(type), () => api.getNewVersionId({ type }));
  return queryResult;
}

export function useVersionHistoryItem(type: VersionHistoryType, versionId: string) {
  const api = useApi();
  const navigate = useNavigate();
  const queryResult = useQuery<VersionHistory>(
    VERSION_HISTORY_ITEM('RiskClassification', versionId ?? ''),
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
