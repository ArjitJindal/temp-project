import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useQuery } from '@/utils/queries/hooks';
import { CRM_ACCOUNT, CRM_RECORDS } from '@/utils/queries/keys';
import type { CRMModelType } from '@/apis';

export function useCrmAccount(userId: string) {
  const api = useApi();
  return useQuery(CRM_ACCOUNT(userId), async () => {
    return api.getCrmAccount({ userId });
  });
}

export function useCrmRecords(params: {
  userId: string;
  page: number;
  pageSize: number;
  modelType: CRMModelType;
  crmName: 'FRESHDESK';
  sortField?: string;
  sortOrder?: 'ascend' | 'descend';
}) {
  const api = useApi();
  const {
    userId,
    page,
    pageSize,
    modelType,
    crmName,
    sortField = 'timestamp',
    sortOrder = 'descend',
  } = params;
  return useQuery(
    CRM_RECORDS(page, pageSize, sortOrder, modelType, crmName, userId),
    async () =>
      await api.getCrmRecords({
        crmName,
        modelType,
        page,
        pageSize,
        sortField,
        sortOrder,
        userId,
      }),
  );
}

export function useCrmSearch(modelType: CRMModelType, crmName: 'FRESHDESK', search: string) {
  const api = useApi();
  return useQuery(
    ['crm-records-search', search],
    async () => {
      const response = await api.getCrmRecordsSearch({
        search,
        modelType,
        crmName,
      });
      return response;
    },
    { enabled: !!search },
  );
}

export function useCrmLinkRecordMutation(userId: string, modelType: CRMModelType) {
  const api = useApi();
  return useMutation(async (crmRecordId: string) => {
    return api.postCrmRecordLink({
      CRMRecordLink: {
        crmName: 'FRESHDESK',
        recordType: modelType,
        id: crmRecordId,
        userId,
        timestamp: Date.now(),
      },
    });
  });
}
