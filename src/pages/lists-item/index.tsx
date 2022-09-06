import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { UnorderedListOutlined } from '@ant-design/icons';
import moment from 'moment';
import s from './index.module.less';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { ListHeader, ListType } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Form from '@/components/ui/Form';
import FontSizeIcon from '@/components/ui/icons/Remix/editor/font-size.react.svg';
import PulseLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import TimeLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import UserListTable from '@/pages/lists-item/UserListTable';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';

export default function CreatedLists() {
  const { type: listType, id: listId } = useParams<'id' | 'type'>();
  const i18n = useI18n();
  const api = useApi();

  const [listHeaderRes, setListHeaderRes] = useState<AsyncResource<ListHeader>>(init());

  useEffect(() => {
    if (listId != null && listType != null) {
      setListHeaderRes((prevState) => loading(getOr(prevState, null)));
      api
        .getList({
          listType: listType as ListType,
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
          url: makeUrl('/lists/:type', { type: listType }),
        }}
      >
        <Card.Root>
          <AsyncResourceRenderer resource={listHeaderRes}>
            {(listHeader) => {
              return (
                <>
                  <Card.Section>
                    <div className={s.header}>
                      <Form.Layout.Label title="List ID">
                        <div className={s.listId}>{listHeader.listId}</div>
                      </Form.Layout.Label>
                      <Form.Layout.Label icon={<UnorderedListOutlined />} title="List type">
                        {listType === 'users-blacklists' ? 'Blacklist' : 'Whitelist'}
                      </Form.Layout.Label>
                      <Form.Layout.Label icon={<FontSizeIcon />} title="List name">
                        {listHeader.metadata?.name}
                      </Form.Layout.Label>
                      <Form.Layout.Label icon={<PulseLineIcon />} title="List description">
                        {listHeader.metadata?.description}
                      </Form.Layout.Label>
                      <Form.Layout.Label icon={<TimeLineIcon />} title="Created on">
                        {moment(listHeader.createdTimestamp).format(
                          DEFAULT_DATE_TIME_DISPLAY_FORMAT,
                        )}
                      </Form.Layout.Label>
                    </div>
                  </Card.Section>
                  <Card.Section>
                    <Card.Root>
                      <Card.Section direction="horizontal" justify="space-between">
                        <Card.Title>Users list</Card.Title>
                      </Card.Section>
                      <Card.Section>
                        <UserListTable listHeader={listHeader} />
                      </Card.Section>
                    </Card.Root>
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
