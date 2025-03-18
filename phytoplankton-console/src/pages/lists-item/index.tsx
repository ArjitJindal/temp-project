import { useLocation, useParams } from 'react-router';
import { UnorderedListOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import pluralize from 'pluralize';
import s from './index.module.less';
import ItemsTable from './ItemsTable';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import * as Form from '@/components/ui/Form';
import FontSizeIcon from '@/components/ui/icons/Remix/editor/font-size.react.svg';
import PulseLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import TimeLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import { parseListType, stringifyListType } from '@/pages/lists/helpers';
import { useQuery } from '@/utils/queries/hooks';
import { LISTS_ITEM } from '@/utils/queries/keys';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import ImportCsvModal from '@/pages/lists-item/ImportCsvModal';
import Skeleton from '@/components/library/Skeleton';
import { isSuccess } from '@/utils/asyncResource';

export default function ListsItemPage() {
  const params = useParams<'id'>();
  const location = useLocation();
  const listType = parseListType(location.pathname);
  const listId = params.id;
  const i18n = useI18n();
  const api = useApi();

  const listHeaderQueryResult = useQuery(LISTS_ITEM(listId), async () => {
    if (listId == null || listType == null) {
      throw new Error(`listId and listType can not be null`);
    }
    const list =
      listType === 'WHITELIST'
        ? await api.getWhitelistListHeader({ listId })
        : await api.getBlacklistListHeader({ listId });
    return list;
  });
  const listHeaderRes = listHeaderQueryResult.data;
  const queryClient = useQueryClient();
  const clearListMutation = useMutation(
    LISTS_ITEM(listId, listType),
    async () => {
      if (!listId) {
        throw new Error('List ID is required');
      }
      const promise =
        listType === 'WHITELIST'
          ? api.clearBlacklistItems({ listId })
          : api.clearWhiteListItems({ listId });

      await promise;
      await queryClient.invalidateQueries(LISTS_ITEM(listId));
    },
    {
      onSuccess: () => {
        message.success('List items successfully cleared!');
      },
      onError: (error) => {
        message.fatal(`Unable to clear list items! ${getErrorMessage(error)}`, error);
      },
    },
  );

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  if (listId == null) {
    throw new Error(`List is should be defined to show this page`);
  }

  return (
    <>
      <PageWrapper
        backButton={{
          title: i18n('menu.lists.created-lists'),
          url: makeUrl('/lists/:type', { type: stringifyListType(listType) }),
        }}
      >
        <Card.Root className={s.root}>
          <Card.Section className={s.header} direction="horizontal" spacing="double">
            <Form.Layout.Label title="List ID">
              <div className={s.listId}>
                <Skeleton res={listHeaderRes}>{(listHeader) => listHeader.listId}</Skeleton>
              </div>
            </Form.Layout.Label>
            <Form.Layout.Label icon={<UnorderedListOutlined />} title="List type">
              {listType === 'BLACKLIST' ? 'Blacklist' : 'Whitelist'}
            </Form.Layout.Label>
            <Form.Layout.Label icon={<FontSizeIcon />} title="List name">
              <Skeleton res={listHeaderRes}>{(listHeader) => listHeader.metadata?.name}</Skeleton>
            </Form.Layout.Label>
            <Form.Layout.Label icon={<PulseLineIcon />} title="List description">
              <Skeleton res={listHeaderRes}>
                {(listHeader) => listHeader.metadata?.description}
              </Skeleton>
            </Form.Layout.Label>
            <Form.Layout.Label icon={<TimeLineIcon />} title="Created at">
              <Skeleton res={listHeaderRes}>
                {(listHeader) =>
                  dayjs(listHeader.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)
                }
              </Skeleton>
            </Form.Layout.Label>
            {isSuccess(listHeaderRes) && listHeaderRes.value?.metadata?.ttl && (
              <Form.Layout.Label icon={<TimeLineIcon />} title="Item expiration time">
                {pluralize(
                  listHeaderRes.value.metadata.ttl.unit.toLocaleLowerCase(),
                  listHeaderRes.value.metadata.ttl.value,
                  true,
                )}
              </Form.Layout.Label>
            )}
          </Card.Section>
          <Card.Section>
            <ItemsTable
              listId={listId}
              listType={listType}
              listHeaderRes={listHeaderRes}
              onImportCsv={() => {
                setIsImportModalOpen(true);
              }}
              clearListMutation={clearListMutation}
            />
          </Card.Section>
        </Card.Root>
      </PageWrapper>
      {listId && (
        <ImportCsvModal
          listId={listId}
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            queryClient.invalidateQueries(LISTS_ITEM(listId));
          }}
          listType={listType as 'WHITELIST' | 'BLACKLIST'}
        />
      )}
    </>
  );
}
