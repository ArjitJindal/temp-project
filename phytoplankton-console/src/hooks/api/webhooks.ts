import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import type { QueryResult } from '@/utils/queries/types';
import type { PaginatedData } from '@/utils/queries/hooks';
import { WEBHOOKS } from '@/utils/queries/keys';
import type { WebhookDeliveryAttempt } from '@/apis';

export function useWebhookDeliveryAttempts(
  webhookId: string,
  params: any,
): QueryResult<PaginatedData<WebhookDeliveryAttempt>> {
  const api = useApi();
  return usePaginatedQuery(WEBHOOKS(webhookId, params), async (paginationParams) => {
    const attempts = await api.getWebhooksWebhookIdDeliveries({
      webhookId,
      ...paginationParams,
      ...(params.success != null && {
        filterStatus: params.success === 'Success' ? 'true' : 'false',
      }),
      filterEventType: params.event,
      filterEventCreatedAtAfterTimestamp: params.eventCreatedAt?.[0]
        ? params.eventCreatedAt?.[0]
        : undefined,
      filterEventCreatedAtBeforeTimestamp: params.eventCreatedAt?.[1]
        ? params.eventCreatedAt?.[1]
        : undefined,
      filterEventDeliveredAtAfterTimestamp: params.requestStartedAt?.[0]
        ? params.requestStartedAt?.[0]
        : undefined,
      filterEventDeliveredAtBeforeTimestamp: params.requestStartedAt?.[1]
        ? params.requestStartedAt?.[1]
        : undefined,
      searchEntityId: params.searchEntityId ? [params.searchEntityId] : [],
    });
    return attempts;
  });
}
