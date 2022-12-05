import _ from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ExpandTabRef } from '../case-management-item/UserCaseDetails';
import UserDetails from './UserDetails';
import Header from './Header';
import { useI18n } from '@/locales';
import PageWrapper from '@/components/PageWrapper';
import { makeUrl } from '@/utils/routing';
import { AsyncResource, failed, init, loading, success } from '@/utils/asyncResource';
import { ApiException, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import COLORS from '@/components/ui/colors';

export default function UserItem() {
  const i18n = useI18n();
  const { list, id } = useParams<'list' | 'id'>(); // todo: handle nulls properly

  const [currentItem, setCurrentItem] = useState<
    AsyncResource<InternalConsumerUser | InternalBusinessUser>
  >(init());
  const api = useApi();
  const handleReload = useCallback(
    (list: string | undefined, id: string | undefined) => {
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
    },
    [api],
  );

  useEffect(() => {
    return handleReload(list, id);
  }, [list, id, handleReload]);

  const onReload = useCallback(() => {
    handleReload(list, id);
  }, [list, id, handleReload]);

  const userRef = React.useRef<ExpandTabRef>(null);

  const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});

  const isAllCollapsed = useMemo(() => {
    return _.every(collapseState, (value) => value);
  }, [collapseState]);

  const updateCollapseState = useCallback(
    (key: string, value: boolean) => {
      setCollapseState((prevState) => ({
        ...prevState,
        [key]: value,
      }));
    },
    [setCollapseState],
  );

  const handleUserUpdate = (userItem: InternalConsumerUser | InternalBusinessUser) => {
    setCurrentItem(success(userItem));
  };

  return (
    <PageWrapper
      backButton={{
        title: i18n(
          list === 'consumer' ? 'menu.users.lists.consumer' : 'menu.users.lists.business',
        ),
        url: makeUrl('/users/list/:list/all', { list }),
      }}
    >
      <Card.Root>
        <AsyncResourceRenderer resource={currentItem}>
          {(user) => (
            <>
              <Card.Section>
                <Header user={user} />
              </Card.Section>
              <Button
                type={'text'}
                onClick={() => userRef.current?.expand(isAllCollapsed)}
                analyticsName={'case-management-item-expand-button'}
                style={{
                  width: 'max-content',
                  margin: '1rem 1.5rem 0rem 1.5rem',
                  color: COLORS.lightBlue.base,
                  borderColor: COLORS.lightBlue.base,
                }}
              >
                {isAllCollapsed ? 'Expand all' : 'Collapse all'}
              </Button>
              <Card.Section>
                <UserDetails
                  user={user}
                  ref={userRef}
                  collapsedByDefault={true}
                  updateCollapseState={updateCollapseState}
                  onUserUpdate={handleUserUpdate}
                  onReload={onReload}
                />
              </Card.Section>
            </>
          )}
        </AsyncResourceRenderer>
      </Card.Root>
    </PageWrapper>
  );
}
