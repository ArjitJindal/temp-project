import React, { useEffect, useState } from 'react';
import { Card } from 'antd';
import { useParams } from 'react-router';
import UserDetails from './UserDetails';
import { useI18n } from '@/locales';
import PageWrapper from '@/components/PageWrapper';
import { makeUrl } from '@/utils/routing';
import { AsyncResource, failed, init, loading, success } from '@/utils/asyncResource';
import { ApiException, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

export default function UserItem() {
  const i18n = useI18n();
  const { list, id } = useParams<'list' | 'id'>(); // todo: handle nulls properly

  const [currentItem, setCurrentItem] = useState<
    AsyncResource<InternalConsumerUser | InternalBusinessUser>
  >(init());
  const api = useApi();
  useEffect(() => {
    if (id == null || id === 'all') {
      setCurrentItem(init());
      return function () {};
    }
    setCurrentItem(loading());
    let isCanceled = false;
    const request =
      list === 'consumer'
        ? api.getConsumerUsersItem({
            userId: id,
          })
        : api.getBusinessUsersItem({ userId: id });
    request
      .then((user) => {
        if (isCanceled) {
          return;
        }
        setCurrentItem(success(user));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        let message = 'Unknown error';
        if (e instanceof ApiException && e.code === 404) {
          message = `Unable to find user by id "${id}"`;
        } else if (e instanceof Error && e.message) {
          message = e.message;
        }
        setCurrentItem(failed(message));
      });
    return () => {
      isCanceled = true;
    };
  }, [list, id, api]);

  // todo: make a proper routing
  return (
    <PageWrapper
      backButton={{
        title: i18n(
          list === 'consumer' ? 'menu.users.lists.consumer' : 'menu.users.lists.business',
        ),
        url: makeUrl('/users/list/:list/all', { list }),
      }}
    >
      <Card>
        <AsyncResourceRenderer resource={currentItem}>
          {(user) => <UserDetails user={user} />}
        </AsyncResourceRenderer>
      </Card>
    </PageWrapper>
  );
}
