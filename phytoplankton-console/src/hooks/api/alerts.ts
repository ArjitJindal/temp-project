import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import {
  ALERT_ITEM,
  ALERT_LIST,
  COPILOT_ALERT_QUESTIONS,
  COPILOT_SUGGESTIONS,
} from '@/utils/queries/keys';
import { parseQuestionResponse } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';
import { NotFoundError } from '@/utils/errors';
import { Alert, InternalTransaction, RuleAction } from '@/apis';

export function useAlert(alertId: string, options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(
    ALERT_ITEM(alertId),
    async () => {
      try {
        return await api.getAlert({ alertId });
      } catch (error: any) {
        if (error?.code === 404) {
          throw new NotFoundError(`Alert with ID "${alertId}" not found`);
        }
        throw error;
      }
    },
    options,
  );
}

// For cases where we already have alert data but want it cached under ALERT_ITEM key
export function useAlertPrimed(alertId: string | undefined, alertData: unknown) {
  return useQuery(ALERT_ITEM(alertId ?? ''), async () => {
    return alertData;
  });
}

export function useCopilotQuestions(alertId: string) {
  const api = useApi();
  return useQuery(COPILOT_ALERT_QUESTIONS(alertId), async () =>
    parseQuestionResponse(await api.getQuestions({ alertId })),
  );
}

export function useCopilotSuggestions(question: string, alertId: string) {
  const api = useApi();
  return useQuery(COPILOT_SUGGESTIONS(question, alertId), async () => {
    const response = await api.getQuestionAutocomplete({ question, alertId });
    return response.suggestions ?? [];
  });
}

export function useAlertList(
  params: { action?: RuleAction; transactionId?: string } & Record<string, unknown>,
  transaction?: InternalTransaction,
) {
  const api = useApi();
  return usePaginatedQuery<Alert>(ALERT_LIST({ ...params }), async ({ page }) => {
    const response = await api.getAlertList({
      ...(params as any),
      page: page ?? (params as any).page,
      filterRuleInstanceId: params.action
        ? (transaction?.hitRules || [])
            .filter((rule) => rule.ruleInstanceId && rule.ruleAction === params.action)
            .map((rule) => rule.ruleInstanceId)
        : undefined,
      filterTransactionIds: params.transactionId ? [params.transactionId] : undefined,
    });
    return {
      items: response.data.map(({ alert }) => alert),
      total: response.total,
    };
  });
}
