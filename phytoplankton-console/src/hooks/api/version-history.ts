import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { NEW_VERSION_ID, VERSION_HISTORY_ITEM } from '@/utils/queries/keys';
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
