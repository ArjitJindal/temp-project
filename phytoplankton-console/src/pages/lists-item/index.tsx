import { useLocation, useParams } from 'react-router';
import { useState } from 'react';
import { UnorderedListOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import pluralize from 'pluralize';
import s from './index.module.less';
import ItemsTable from './ItemsTable';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import * as Form from '@/components/ui/Form';
import FontSizeIcon from '@/components/ui/icons/Remix/editor/font-size.react.svg';
import PulseLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import TimeLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import { parseListType, stringifyListType } from '@/pages/lists/helpers';
import { LISTS_ITEM_TYPE } from '@/utils/queries/keys';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import Skeleton from '@/components/library/Skeleton';
import { getOr, isSuccess } from '@/utils/asyncResource';
import { useClearListMutation, useFlatFileProgress, useListHeader } from '@/hooks/api/lists';
import { Progress } from '@/components/Simulation/Progress';

export default function ListsItemPage() {
  const params = useParams<'id'>();
  const location = useLocation();
  const listType = parseListType(location.pathname);
  const listId = params.id;
  const i18n = useI18n();
  const [showProgress, setShowProgress] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isFlatFileProgressLoading, setIsFlatFileProgressLoading] = useState(false);

  const listHeaderQueryResult = useListHeader(listType, listId);
  const listHeaderRes = listHeaderQueryResult.data;
  const listHeaderData = getOr(listHeaderRes, null);

  const flatFileProgressQueryResult = useFlatFileProgress(listId ?? '', 'CUSTOM_LIST_UPLOAD', {
    enabled: !!listId && isSuccess(listHeaderRes) && listHeaderData?.subtype === 'CUSTOM',
    onSuccess: (data) => {
      setShowProgress(['IN_PROGRESS'].includes(data.status ?? ''));
      if (data.status === 'SUCCESS' || data.status === 'FAILED') {
        queryClient.invalidateQueries({
          queryKey: LISTS_ITEM_TYPE(params.id ?? '', listType, listHeaderData?.subtype ?? null),
          exact: false,
        });
        setIsFlatFileProgressLoading(false);
        setShowProgress(false);

        if (!isInitialLoad) {
          if (data.status === 'SUCCESS') {
            message.success('List items uploaded successfully');
          } else {
            if (data.saved || data.total) {
              message.error(
                `List items upload failed ${
                  (data.saved || 0) < (data.total || 0) ? 'partially' : ''
                }`,
              );
            }
          }
        }

        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      }
    },
    onError: () => {
      setShowProgress(false);
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    },
    refetchInterval: (data) => {
      return ['IN_PROGRESS', 'PENDING'].includes(data?.status ?? '') ? 1000 : false;
    },
  });

  const queryClient = useQueryClient();
  const clearListMutation = useClearListMutation(listType, listId ?? '', {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: LISTS_ITEM_TYPE(params.id ?? '', listType, listHeaderData?.subtype ?? null),
        exact: false,
      });
      message.success('List items cleared successfully');
    },
    onError: (error) => {
      message.fatal(`Unable to clear list items! ${getErrorMessage(error)}`, error);
    },
  });

  if (listId == null) {
    throw new Error(`List is should be defined to show this page`);
  }

  return (
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
          {isSuccess(listHeaderRes) && listHeaderData?.metadata?.ttl && (
            <Form.Layout.Label icon={<TimeLineIcon />} title="Item expiration time">
              {pluralize(
                listHeaderData.metadata.ttl.unit.toLocaleLowerCase(),
                listHeaderData.metadata.ttl.value,
                true,
              )}
            </Form.Layout.Label>
          )}
        </Card.Section>
        <Card.Section>
          {showProgress || isFlatFileProgressLoading ? (
            <Progress
              status={showProgress ? 'IN_PROGRESS' : 'PENDING'}
              width="FULL"
              progress={(getOr(flatFileProgressQueryResult.data, { saved: 0 }).saved || 0) / 100}
              totalEntities={getOr(flatFileProgressQueryResult.data, { total: 0 }).total}
              progressMessage="Items imported"
              loadingMessage={
                getOr(flatFileProgressQueryResult.data, { isValidationJobRunning: false })
                  .isValidationJobRunning
                  ? 'Validating items...'
                  : 'Importing items...'
              }
            />
          ) : (
            <ItemsTable
              listId={listId}
              listType={listType}
              listHeaderRes={listHeaderRes}
              clearListMutation={clearListMutation}
              isCustomList={isSuccess(listHeaderRes) && listHeaderData?.subtype === 'CUSTOM'}
              setIsFlatFileProgressLoading={setIsFlatFileProgressLoading}
            />
          )}
        </Card.Section>
      </Card.Root>
    </PageWrapper>
  );
}
