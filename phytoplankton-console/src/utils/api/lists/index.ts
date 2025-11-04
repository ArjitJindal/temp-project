import { useMutation, useQueryClient } from '@tanstack/react-query';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
import { useApi } from '@/api';
import { useCursorQuery, useQuery } from '@/utils/queries/hooks';
import { FLAT_FILE_PROGRESS, LISTS, LISTS_ITEM, LISTS_ITEM_TYPE } from '@/utils/queries/keys';
import {
  FlatFileProgressResponse,
  FlatFileSchema,
  ListSubtype,
  ListSubtypeInternal,
  ListType,
  ListMetadata,
  ListHeaderInternal,
} from '@/apis';
import { UseQueryOptions } from '@/utils/api/types';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import type {
  DefaultApiGetListsRequest,
  DefaultApiGetWhiteListItemsRequest,
} from '@/apis/types/ObjectParamAPI';
import { TableItem } from '@/pages/lists-item/ItemsTable';
import { stringifyListType } from '@/pages/lists/helpers';
import { makeUrl } from '@/utils/routing';
import { useAuth0User } from '@/utils/user-utils';
import { AllParams } from '@/components/library/Table/types';
import { TableParams } from '@/pages/lists-item/ItemsTable/types';

export const useFlatFileProgress = (
  schema: FlatFileSchema,
  entityId: string,
  options?: UseQueryOptions<FlatFileProgressResponse>,
) => {
  const api = useApi();
  return useQuery(
    FLAT_FILE_PROGRESS(entityId),
    async () => {
      const flatFileProgress = await api.getFlatFilesProgress({
        schema,
        entityId,
      });
      return flatFileProgress;
    },
    options,
  );
};

export const useListItem = (listId: string, listType: ListType) => {
  const api = useApi();
  return useQuery(
    LISTS_ITEM(listId),
    async () => {
      const list =
        listType === 'WHITELIST'
          ? await api.getWhitelistListHeader({ listId })
          : await api.getBlacklistListHeader({ listId });
      return list;
    },
    {
      enabled: !!listId && !!listType,
    },
  );
};

export const useListItems = ({
  listId,
  listType,
  listSubType,
  params,
  filterKeys,
}: {
  listId: string;
  listType: ListType;
  listSubType: ListSubtypeInternal | null;
  params: AllParams<TableParams>;
  filterKeys: string[];
}) => {
  const api = useApi();
  return useCursorQuery(
    LISTS_ITEM_TYPE(listId, listType, listSubType, { ...params, filterKeys }),
    async ({ from }) => {
      const payload: DefaultApiGetWhiteListItemsRequest = {
        listId,
        start: params.from || from,
        pageSize: params.pageSize,
        filterKeys,
      };

      const response =
        listType === 'WHITELIST'
          ? await api.getWhiteListItems(payload)
          : await api.getBlacklistItems(payload);

      const data: TableItem[] = response.items.map(
        ({ key, metadata }): TableItem => ({
          rowKey: key,
          type: 'EXISTED',
          value: key,
          reason: metadata?.reason ?? '',
          meta: metadata ?? {},
        }),
      );
      return {
        ...response,
        items: data,
        total: response.count,
      };
    },
  );
};

type UseListsParams = {
  listType?: ListType;
  listSubtype?: ListSubtype;
  filters?: DefaultApiGetListsRequest & {
    filterUserIds?: string[];
  };
};

export const useLists = ({ listType, listSubtype, filters }: UseListsParams) => {
  const api = useApi();
  return useQuery(LISTS(listType, listSubtype, filters), async () => {
    if (listType === 'WHITELIST') {
      return api.getWhitelist();
    }
    if (listType === 'BLACKLIST') {
      return api.getBlacklist();
    }
    return api.getLists({
      ...(filters ?? {}),
    });
  });
};

export const useClearListItems = (
  listId: string,
  listType: ListType,
  listSubType: ListSubtypeInternal | null,
) => {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation(
    LISTS_ITEM(listId),
    async () => {
      if (listType === 'WHITELIST') {
        await api.clearWhiteListItems({ listId });
      } else {
        await api.clearBlacklistItems({ listId });
      }
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: LISTS_ITEM_TYPE(listId, listType, listSubType),
          exact: false,
        });
        message.success('List items cleared successfully');
      },
      onError: (error) => {
        message.fatal(`Unable to clear list items! ${getErrorMessage(error)}`, error);
      },
    },
  );
};

export const useListMutation = ({ listType }: { listType: ListType }) => {
  const api = useApi();
  const auth0User = useAuth0User();
  const queryClient = useQueryClient();
  return useMutation(
    async ({ listId, metadata }: { listId: string; metadata: ListMetadata }) => {
      try {
        if (listType === 'WHITELIST') {
          await api.patchWhiteList({ listId, ListData: { metadata } });
        } else {
          await api.patchBlacklist({ listId, ListData: { metadata } });
        }
        message.success(`List ${metadata.status ? 'enabled' : 'disabled'} successfully`, {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} ${
            metadata.status ? 'enabled' : 'disabled'
          } the list ${metadata.name}`,
          link: makeUrl('/lists/:type/:listId', {
            type: stringifyListType(listType),
            listId: listId,
          }),
          linkTitle: 'View list',
          copyFeedback: 'List URL copied to clipboard',
        });
      } catch (error) {
        message.fatal(`Unable to update list! ${getErrorMessage(error)}`, error);
      } finally {
        message.loading('Updating list...');
      }
    },
    {
      onMutate: async ({ listId, metadata }) => {
        const listsKey = LISTS(listType);
        const previousList = queryClient.getQueryData<ListHeaderInternal[]>(listsKey);
        queryClient.setQueryData<ListHeaderInternal[]>(listsKey, (prevState) =>
          prevState?.map((listHeader) =>
            listHeader.listId === listId ? { ...listHeader, metadata } : listHeader,
          ),
        );
        return { previousList };
      },
      onError: (err, event, context) => {
        queryClient.setQueryData(LISTS(listType), context?.previousList);
      },
    },
  );
};
