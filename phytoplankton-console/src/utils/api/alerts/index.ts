import { useQueryClient } from '@tanstack/react-query';
import { Updater } from '@tanstack/react-table';
import { useCallback } from 'react';
import {
  ALERT_ITEM,
  ALERT_ITEM_COMMENTS,
  ALERT_ITEM_TRANSACTION_LIST,
  ALERT_LIST,
  ALERT_QA_SAMPLE,
  ALERT_COMMENTS,
  COPILOT_ALERT_QUESTIONS,
  ALERT_QA_SAMPLING,
  ALERT_CHECKLIST,
  TRANSACTIONS_ITEM_RISKS_ARS,
  MEDIA_CHECK_ARTICLES_SEARCH,
} from '../../queries/keys';
import {
  usePaginatedQuery,
  useQuery,
  useCursorQuery,
  CursorPaginationParams,
} from '../../queries/hooks';
import { useMutation } from '../../queries/mutations/hooks';
import { useAuth0User } from '../../user-utils';
import { HistoryItem, ChecklistCategory, ChecklistItem, HydratedChecklist } from './types';
import { Alert, AlertStatus } from '@/apis';
import { useApi } from '@/api';
import { notFound } from '@/utils/errors';
import { UseQueryOptions } from '@/utils/api/types';
import { getAlertsQueryParams, presentAlertData } from '@/pages/case-management/utils';
import { AllParams } from '@/components/library/Table/types';
import { TableSearchParams } from '@/pages/case-management/types';
import { DEFAULT_PAGINATION_VIEW } from '@/components/library/Table/consts';
import { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';
import { parseQuestionResponse } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { QASamplesTableParams } from '@/pages/qa-samples';
import { getOr, isSuccess } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';

export function isScreeningAlert(alert: Alert | undefined): boolean {
  return (
    alert?.ruleNature === 'SCREENING' &&
    alert.ruleHitMeta?.sanctionsDetails != null &&
    alert.alertId != null
  );
}

export const useAlertDetails = (alertId: string | undefined, options?: UseQueryOptions<Alert>) => {
  const api = useApi();

  const alertDetailsQuery = useQuery(
    ALERT_ITEM(alertId ?? ''),
    async () => {
      try {
        return await api.getAlert({ alertId: alertId ?? '' });
      } catch (error: any) {
        if (error.code === 404) {
          notFound(`Alert with ID "${alertId}" not found`);
        }
        throw error;
      }
    },
    {
      enabled: !!alertId,
      ...options,
    },
  );

  return alertDetailsQuery;
};

export const usePaginatedAlertList = (
  params: AllParams<TableSearchParams>,
  defaultApiParams?: DefaultApiGetAlertListRequest,
) => {
  const api = useApi();
  const user = useAuth0User();

  return usePaginatedQuery(
    ALERT_LIST({ ...params, ...defaultApiParams }),
    async (paginationParams) => {
      const preparedParams = getAlertsQueryParams(params, user, paginationParams, defaultApiParams);

      const result = await api.getAlertList(
        Object.entries(preparedParams).reduce(
          (acc, [key, value]) => ({ ...acc, [key]: value }),
          {},
        ),
      );
      return {
        items: presentAlertData(result.data),
        total: result.total,
        totalPages: result.totalPages,
      };
    },
    { meta: { atf: true } },
  );
};

export const useAlertList = (params, options) => {
  const api = useApi();
  return useQuery(ALERT_LIST({ ...params }), () => api.getAlertList(params), options);
};

export const useAlertCopilotQuestions = (alertId: string) => {
  const api = useApi();
  return useQuery(
    COPILOT_ALERT_QUESTIONS(alertId),
    async () => parseQuestionResponse(await api.getQuestions({ alertId })),
    {
      enabled: !!alertId,
    },
  );
};

export const useAlertTransactionList = (alertId: string, params: any) => {
  const api = useApi();
  return useCursorQuery(
    ALERT_ITEM_TRANSACTION_LIST(alertId, params),
    async ({ from, view }) => {
      return await api.getAlertTransactionList({
        ...params,
        start: from || params.from,
        view: view ?? DEFAULT_PAGINATION_VIEW,
        alertId,
      });
    },
    {
      enabled: !!alertId,
    },
  );
};

export const useAlertQaSample = (sampleId: string) => {
  const api = useApi();
  return useQuery(
    ALERT_QA_SAMPLE(sampleId),
    async () => await api.getAlertsQaSample({ sampleId }),
    { enabled: !!sampleId },
  );
};

export const useAlertComments = (alertIds: string[]) => {
  const api = useApi();
  return useQuery(
    ALERT_COMMENTS(alertIds),
    async () => await api.getComments({ filterEntityIds: alertIds, filterEntityTypes: ['ALERT'] }),
    { enabled: alertIds.length > 0 },
  );
};

export const useAlertQaSampling = (params: AllParams<QASamplesTableParams>) => {
  const api = useApi();
  return usePaginatedQuery(ALERT_QA_SAMPLING({ ...params }), async (paginationParams) => {
    const data = await api.getAlertsQaSampling({
      ...paginationParams,
      sortField: params.sort?.[0]?.[0],
      sortOrder: params.sort?.[0]?.[1] ?? 'descend',
      filterSampleName: params.samplingName,
      filterSampleId: params.samplingId,
      filterPriority: params.priority,
      filterCreatedById: params.createdBy,
      filterCreatedBeforeTimestamp: params.createdAt?.[1],
      filterCreatedAfterTimestamp: params.createdAt?.[0],
    });
    return {
      items: data.data,
      total: data.total,
    };
  });
};

export const useAlertChecklist = (alertId: string | undefined) => {
  const api = useApi();
  const alertDetailsQuery = useAlertDetails(alertId);

  return useQuery(
    ALERT_CHECKLIST(alertId ?? ''),
    async () => {
      const alert = getOr(alertDetailsQuery.data, undefined);

      const ruleInstances = await api.getRuleInstances({});

      const ruleInstance = ruleInstances.find((ri) => ri.id === alert?.ruleInstanceId);
      if (!ruleInstance) {
        throw new Error('Could not resolve alert rule instance');
      }
      if (!ruleInstance.checklistTemplateId) {
        throw new Error('Rule instance doesnt have checklist assigned');
      }

      const template = await api.getChecklistTemplate({
        checklistTemplateId: ruleInstance.checklistTemplateId,
      });

      return (
        template?.categories?.map((category): ChecklistCategory => {
          return {
            name: category.name,
            items: category.checklistItems.map((cli): ChecklistItem => {
              const item = alert?.ruleChecklist?.find((item) => item.checklistItemId === cli.id);
              if (!item) {
                throw new Error(
                  'Alert is missing checklist status information, please contact support',
                );
              }
              return {
                id: cli.id,
                name: cli.name,
                level: cli.level,
                qaStatus: item.status,
                done: item.done ?? 'NOT_STARTED',
                comment: item.comment,
              };
            }),
          };
        }) ?? []
      );
    },
    {
      enabled: !!alertId && isSuccess(alertDetailsQuery.data),
    },
  );
};

export const useTransactionARS = (transactionId: string) => {
  const api = useApi();
  return useQuery(
    TRANSACTIONS_ITEM_RISKS_ARS(transactionId),
    () => api.getArsValue({ transactionId }),
    {
      enabled: !!transactionId,
    },
  );
};

export const useAlertStatusChangeMutation = (
  alertId: string | undefined,
  options?: { onReload?: () => void },
) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation(
    async (newStatus: AlertStatus) => {
      if (alertId == null) {
        throw new Error('Alert ID is not defined');
      }
      const hideMessage = message.loading('Changing alert status...');
      try {
        await api.alertsStatusChange({
          AlertsStatusUpdateRequest: {
            alertIds: [alertId],
            updates: {
              reason: [],
              alertStatus: newStatus,
            },
          },
        });
      } finally {
        hideMessage();
      }
    },
    {
      onSuccess: async () => {
        if (alertId != null) {
          await queryClient.invalidateQueries({ queryKey: ALERT_ITEM(alertId) });
        }
        await queryClient.invalidateQueries({ queryKey: ALERT_LIST() });
        message.success('Alert status updated');
        options?.onReload?.();
      },
      onError: (error: Error) => {
        message.error(`Failed to change alert status: ${error.message}`);
      },
    },
  );
};

export const useAlertUpdates = () => {
  const queryClient = useQueryClient();

  const updateAlertQueryData = useCallback(
    (alertId: string | undefined, updater: Updater<Alert | undefined>) => {
      if (alertId) {
        queryClient.setQueryData<Alert>(ALERT_ITEM(alertId), updater);
      }
    },
    [queryClient],
  );

  const updateAlertItemCommentsData = useCallback(
    (alertId: string | undefined, updater: Updater<Alert['comments'] | undefined>) => {
      if (alertId) {
        queryClient.setQueryData<Alert['comments']>(ALERT_ITEM_COMMENTS(alertId), updater);
      }
    },
    [queryClient],
  );

  const updateAlertCopilotQuestionsData = useCallback(
    (alertId: string | undefined, updater: Updater<HistoryItem[] | undefined>) => {
      if (alertId) {
        queryClient.setQueryData<HistoryItem[]>(COPILOT_ALERT_QUESTIONS(alertId), updater);
      }
    },
    [queryClient],
  );

  const updateAlertChecklistData = useCallback(
    (alertId: string | undefined, updater: Updater<HydratedChecklist | undefined>) => {
      if (alertId) {
        queryClient.setQueryData<HydratedChecklist>(ALERT_CHECKLIST(alertId), updater);
      }
    },
    [queryClient],
  );

  return {
    updateAlertQueryData,
    updateAlertItemCommentsData,
    updateAlertCopilotQuestionsData,
    updateAlertChecklistData,
  };
};

export const useMediaCheckArticles = (
  searchId: string | undefined,
  params: AllParams<CursorPaginationParams>,
) => {
  const api = useApi();
  return useCursorQuery(
    MEDIA_CHECK_ARTICLES_SEARCH(searchId, { ...params }),
    async () => {
      return await api.getMediaCheckArticles({
        pageSize: params.pageSize,
        searchId: searchId ?? '',
        fromCursorKey: params.from,
      });
    },
    {
      enabled: !!searchId,
    },
  );
};
