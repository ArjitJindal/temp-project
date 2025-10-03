import { useApi } from '@/api';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useQuery } from '@/utils/queries/hooks';
import type { QueryResult } from '@/utils/queries/types';
import { LISTS, LISTS_OF_TYPE } from '@/utils/queries/keys';
import type { ListMetadata, ListType } from '@/apis';

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
