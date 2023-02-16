import _ from 'lodash';
import { useCallback, useContext, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import UserDetails from './UserDetails';
import Header from './Header';
import { useI18n } from '@/locales';
import PageWrapper from '@/components/PageWrapper';
import { makeUrl } from '@/utils/routing';
import { InternalBusinessUser, InternalConsumerUser, Comment } from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import COLORS from '@/components/ui/colors';
import {
  ExpandableContext,
  ExpandableProvider,
} from '@/components/AppWrapper/Providers/ExpandableProvider';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { useQuery } from '@/utils/queries/hooks';
import { UI_SETTINGS } from '@/pages/users-item/ui-settings';
import { USERS_ITEM } from '@/utils/queries/keys';

function UserItem() {
  const { list, id } = useParams<'list' | 'id'>(); // todo: handle nulls properly
  usePageViewTracker('User Item');
  const api = useApi();
  const measure = useApiTime();
  const queryClient = useQueryClient();

  const queryResult = useQuery<InternalConsumerUser | InternalBusinessUser>(
    USERS_ITEM(id as string),
    () => {
      if (id == null) {
        throw new Error(`Id is not defined`);
      }
      return list === 'consumer'
        ? measure(() => api.getConsumerUsersItem({ userId: id }), 'Consumer User Item')
        : measure(() => api.getBusinessUsersItem({ userId: id }), 'Business User Item');
    },
  );

  const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});

  const isAllCollapsed = useMemo(() => {
    return _.every(collapseState, (value) => value);
  }, [collapseState]);

  const expandableContext = useContext(ExpandableContext);
  const updateCollapseState = useCallback(
    (key: string, value: boolean) => {
      expandableContext.setExpandMode('MANUAL');
      setCollapseState((prevState) => ({
        ...prevState,
        [key]: value,
      }));
    },
    [expandableContext],
  );

  const handleUserUpdate = (userItem: InternalConsumerUser | InternalBusinessUser) => {
    queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
      USERS_ITEM(id as string),
      userItem,
    );
  };

  const handleNewComment = (newComment: Comment) => {
    queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
      USERS_ITEM(id as string),
      (user) => {
        if (user == null) {
          return user;
        }
        return {
          ...user,
          comments: [...(user?.comments ?? []), newComment],
        };
      },
    );
  };

  return (
    <Card.Root collapsable={false}>
      <AsyncResourceRenderer resource={queryResult.data}>
        {(user) => (
          <>
            <Header user={user} onNewComment={handleNewComment} />
            <Button
              type={'TEXT'}
              onClick={() =>
                expandableContext.setExpandMode(isAllCollapsed ? 'EXPAND_ALL' : 'COLLAPSE_ALL')
              }
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
                updateCollapseState={updateCollapseState}
                onUserUpdate={handleUserUpdate}
                onReload={queryResult.refetch}
                uiSettings={UI_SETTINGS}
              />
            </Card.Section>
          </>
        )}
      </AsyncResourceRenderer>
    </Card.Root>
  );
}

export default function UserItemWrapper() {
  const i18n = useI18n();
  const { list } = useParams<'list' | 'id'>(); // todo: handle nulls properly
  return (
    <PageWrapper
      backButton={{
        title: i18n(
          list === 'consumer' ? 'menu.users.lists.consumer' : 'menu.users.lists.business',
        ),
        url: makeUrl('/users/list/:list/all', { list }),
      }}
    >
      <ExpandableProvider>
        <UserItem />
      </ExpandableProvider>
    </PageWrapper>
  );
}
