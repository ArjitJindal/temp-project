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
      start: from || params.from,
      pageSize: params.pageSize,
      filterUserId: params.userId ? [params.userId] : undefined,
      filterEntity: params.entity ? [params.entity] : undefined,
      filterEntityType: params.entityType ? [params.entityType] : undefined,
    });
  });
}
