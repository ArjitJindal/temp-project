import { useApi } from '@/api';
import { useCursorQuery } from '@/utils/queries/hooks';
import { SANCTIONS_WHITELIST_SEARCH } from '@/utils/queries/keys';

export function useSanctionsWhitelistSearch(params: {
  from?: string | null;
  pageSize: number;
  userId?: string | null;
  entity?: string | null;
  entityType?: string | null;
}) {
  const api = useApi();
  return useCursorQuery(SANCTIONS_WHITELIST_SEARCH(params), async ({ from }) => {
    return api.searchSanctionsWhitelist({
      start: from ?? params.from ?? undefined,
      pageSize: params.pageSize,
      filterUserId: params.userId != null ? [params.userId] : undefined,
      filterEntity: params.entity != null ? [params.entity] : undefined,
      filterEntityType: params.entityType != null ? [params.entityType] : undefined,
    });
  });
}
