import { useApi } from '@/api';
import { useCursorQuery, useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import type { CursorPaginatedData } from '@/utils/queries/hooks';
import type { QueryResult, QueryOptions } from '@/utils/queries/types';
import {
  FLAT_FILE_PROGRESS,
  LISTS,
  LISTS_ITEM,
  LISTS_ITEM_TYPE,
  LISTS_OF_TYPE,
} from '@/utils/queries/keys';
import type { DefaultApiGetWhiteListItemsRequest } from '@/apis/types/ObjectParamAPI';
import type {
  ListMetadata,
  ListType,
  FlatFileProgressResponse,
  ListSubtypeInternal,
  ListHeaderInternal,
} from '@/apis';

export interface ExistingListTableItemMeta {
  reason?: string;
  [key: string]: any;
}
export type ListTableItem =
  | {
      rowKey: string;
      type: 'EXISTED';
      value: string;
      reason: string;
      meta: ExistingListTableItemMeta;
    }
  | {
      rowKey: 'NEW';
      type: 'NEW';
      value: string[];
      reason: string;
      meta: ExistingListTableItemMeta;
    };

export function useListItemsCursor(
  listId: string,
  listType: ListType,
  listSubtype: ListSubtypeInternal | null,
  params: { from?: number; pageSize?: number; filterKeys?: string[] | string | undefined },
): QueryResult<CursorPaginatedData<ListTableItem>> {
  const api = useApi();
  const { filterKeys, ...rest } = params ?? {};
  return useCursorQuery<ListTableItem>(
    LISTS_ITEM_TYPE(listId, listType, listSubtype, {
      ...rest,
      filterKeys: Array.isArray(filterKeys) ? filterKeys : filterKeys ? [filterKeys] : undefined,
    }),
    async ({ from }) => {
      const restTyped = rest as { from?: number; pageSize?: number };
      const payload: DefaultApiGetWhiteListItemsRequest = {
        listId,
        start: String(restTyped.from ?? from ?? 0),
        pageSize: restTyped.pageSize ?? 25,
        filterKeys: Array.isArray(filterKeys) ? filterKeys : filterKeys ? [filterKeys] : undefined,
      };

      const response =
        listType === 'WHITELIST'
          ? await api.getWhiteListItems(payload)
          : await api.getBlacklistItems(payload);

      const items: ListTableItem[] = [
        ...response.items.map(({ key, metadata }) => ({
          rowKey: key,
          type: 'EXISTED' as const,
          value: key,
          reason: (metadata as ExistingListTableItemMeta | undefined)?.reason ?? '',
          meta: (metadata as ExistingListTableItemMeta | undefined) ?? {},
        })),
        ...(filterKeys == null
          ? [
              {
                rowKey: 'NEW' as const,
                type: 'NEW' as const,
                value: [],
                reason: '',
                meta: {},
              },
            ]
          : []),
      ];

      return {
        ...response,
        items,
        total: response.count,
      } as CursorPaginatedData<ListTableItem>;
    },
  );
}

export function useUserLists(): QueryResult<ListHeaderInternal[]> {
  const api = useApi();
  return useQuery(LISTS('USER_ID'), async () => {
    return await api.getLists({
      filterListSubtype: ['USER_ID'],
    });
  });
}

export function useListsByUserId(
  userId: string,
): QueryResult<{ items: ListHeaderInternal[]; total: number }> {
  const api = useApi();
  return useQuery([LISTS(), userId], async () => {
    const response = await api.getLists({ filterUserIds: [userId] });
    const items = Array.isArray(response) ? (response as ListHeaderInternal[]) : [];
    return { items, total: items.length };
  });
}

export function useLists(listType?: ListType): QueryResult<ListHeaderInternal[]> {
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
  return useQuery(LISTS_ITEM(listId, listType as ListType | undefined), async () => {
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

export function useClearListMutation(
  listType: ListType,
  listId: string,
  options?: { onSuccess?: () => void; onError?: (e: Error) => void },
) {
  const api = useApi();
  return useMutation<void, Error, void>(async () => {
    if (!listId) {
      throw new Error('List ID is required');
    }
    const promise =
      listType === 'WHITELIST'
        ? api.clearWhiteListItems({ listId })
        : api.clearBlacklistItems({ listId });
    await promise;
  }, options);
}
