import { useApi } from '@/api';
import { InternalConsumerUser, InternalBusinessUser } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_ITEM } from '@/utils/queries/keys';
import { QueryResult } from '@/utils/queries/types';

export const useConsoleUser = (
  id?: string,
): QueryResult<InternalConsumerUser | InternalBusinessUser> => {
  const api = useApi();
  return useQuery<InternalConsumerUser | InternalBusinessUser>(USERS_ITEM(id), () => {
    if (id == null) {
      throw new Error(`Id is not defined`);
    }
    return api.getUsersItem({ userId: id });
  });
};
