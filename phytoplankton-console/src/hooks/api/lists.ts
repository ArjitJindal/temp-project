import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useQuery } from '@/utils/queries/hooks';
import type { QueryResult, QueryOptions } from '@/utils/queries/types';
import { FLAT_FILE_PROGRESS, LISTS, LISTS_ITEM, LISTS_OF_TYPE } from '@/utils/queries/keys';
import type { ListMetadata, ListType, ListHeaderInternal, FlatFileProgressResponse } from '@/apis';

export function useUserLists(): QueryResult<any> {
  const api = useApi();
  return useQuery(LISTS('USER_ID'), async () => {
    return await api.getLists({
      filterListSubtype: ['USER_ID'],
    });
  });
}

export function useListsByUserId(userId: string): QueryResult<{ items: any[]; total: number }> {
  const api = useApi();
  return useQuery([LISTS(), userId], async () => {
    const response = await api.getLists({ filterUserIds: [userId] });
    return {
      items: Array.isArray(response) ? response : [],
      total: Array.isArray(response) ? response.length : 0,
    };
  });
}

export function useLists(listType?: ListType): QueryResult<any> {
  const api = useApi();
  return useQuery(LISTS_OF_TYPE(listType), () => {
    if (listType === 'WHITELIST') {
      return api.getWhitelist();
    }
    if (listType === 'BLACKLIST') {
      return api.getBlacklist();
    }
    return api.getLists();
  });
}

export function usePatchListMetadata(listType: ListType) {
  const api = useApi();
  return useMutation((vars: { listId: string; metadata: ListMetadata }) => {
    if (listType === 'WHITELIST') {
      return api.patchWhiteList({ listId: vars.listId, ListData: { metadata: vars.metadata } });
    }
    if (listType === 'BLACKLIST') {
      return api.patchBlacklist({ listId: vars.listId, ListData: { metadata: vars.metadata } });
    }
    throw new Error('Changing metadata is not supported for this list type');
  });
}

export function useListHeader(listType: ListType | null, listId: string | undefined) {
  const api = useApi();
  return useQuery<ListHeaderInternal>(LISTS_ITEM(listId, listType as any), async () => {
    if (!listId || !listType) {
      throw new Error('listId and listType are required');
    }
    return listType === 'WHITELIST'
      ? await api.getWhitelistListHeader({ listId })
      : await api.getBlacklistListHeader({ listId });
  });
}

export function useFlatFileProgress(
  entityId: string | undefined,
  schema: 'CUSTOM_LIST_UPLOAD',
  options?: QueryOptions<FlatFileProgressResponse, FlatFileProgressResponse>,
) {
  const api = useApi();
  return useQuery(
    FLAT_FILE_PROGRESS(entityId ?? ''),
    async () => {
      if (!entityId) {
        throw new Error('entityId is required');
      }
      return await api.getFlatFilesProgress({ schema, entityId });
    },
    options,
  );
}

export function useClearListMutation(listType: ListType, listId: string, options?: any) {
  const api = useApi();
  return useMutation<unknown, unknown, void>(async () => {
    if (!listId) {
      throw new Error('List ID is required');
    }
    const promise =
      listType === 'WHITELIST'
        ? api.clearBlacklistItems({ listId })
        : api.clearWhiteListItems({ listId });
    await promise;
  }, options);
}
