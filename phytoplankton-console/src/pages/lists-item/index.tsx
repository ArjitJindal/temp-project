import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { UnorderedListOutlined } from '@ant-design/icons';
import s from './index.module.less';
import ItemsTable from './ItemsTable';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { ListHeader } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Form from '@/components/ui/Form';
import FontSizeIcon from '@/components/ui/icons/Remix/editor/font-size.react.svg';
import PulseLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import TimeLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import { parseListType, stringifyListType } from '@/pages/lists/helpers';

export default function CreatedLists() {
  const params = useParams<'id' | 'type'>();
  const listType = parseListType(params.type);
  const listId = params.id;
  const i18n = useI18n();
  const api = useApi();

  const [listHeaderRes, setListHeaderRes] = useState<AsyncResource<ListHeader>>(init());

  useEffect(() => {
    if (listId != null && listType != null) {
      setListHeaderRes((prevState) => loading(getOr(prevState, null)));
      api
        .getList({
          listId,
        })
        .then(
          (list) => {
            setListHeaderRes(success(list));
          },
          () => {
            setListHeaderRes(failed(`Unable to find a list by id "${listId}"`));
          },
        );
    }
  }, [api, listId, listType]);

  return (
    <>
      <PageWrapper
        backButton={{
          title: i18n('menu.lists.created-lists'),
          url: makeUrl('/lists/:type', { type: stringifyListType(listType) }),
        }}
      >
        <Card.Root className={s.root}>
          <AsyncResourceRenderer resource={listHeaderRes}>
            {(listHeader) => {
              return (
                <>
                  <Card.Section className={s.header} direction="horizontal" spacing="double">
                    <Form.Layout.Label title="List ID">
                      <div className={s.listId}>{listHeader.listId}</div>
                    </Form.Layout.Label>
                    <Form.Layout.Label icon={<UnorderedListOutlined />} title="List type">
                      {listType === 'BLACKLIST' ? 'Blacklist' : 'Whitelist'}
                    </Form.Layout.Label>
                    <Form.Layout.Label icon={<FontSizeIcon />} title="List name">
                      {listHeader.metadata?.name}
                    </Form.Layout.Label>
                    <Form.Layout.Label icon={<PulseLineIcon />} title="List description">
                      {listHeader.metadata?.description}
                    </Form.Layout.Label>
                    <Form.Layout.Label icon={<TimeLineIcon />} title="Created at">
                      {dayjs(listHeader.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
                    </Form.Layout.Label>
                  </Card.Section>
                  <Card.Section>
                    <ItemsTable listHeader={listHeader} />
                  </Card.Section>
                </>
              );
            }}
          </AsyncResourceRenderer>
        </Card.Root>
      </PageWrapper>
    </>
  );
}
