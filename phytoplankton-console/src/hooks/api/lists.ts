import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { LISTS } from '@/utils/queries/keys';

export function useUserLists() {
  const api = useApi();
  return useQuery(LISTS('USER_ID'), async () => {
    return await api.getLists({
      filterListSubtype: ['USER_ID'],
    });
  });
}

export function useListsByUserId(userId: string) {
  const api = useApi();
  return useQuery([LISTS(), userId], async () => {
    const response = await api.getLists({ filterUserIds: [userId] });
    return {
      items: Array.isArray(response) ? response : [],
      total: Array.isArray(response) ? response.length : 0,
    };
  });
}

export function useLists(listType?: 'WHITELIST' | 'BLACKLIST' | undefined) {
  const api = useApi();
  return useQuery(LISTS(), () => {
    if (listType === 'WHITELIST') {
      return api.getWhitelist();
    }
    if (listType === 'BLACKLIST') {
      return api.getBlacklist();
    }
    return api.getLists();
  });
}
