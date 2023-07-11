import { Tabs as AntTabs } from 'antd';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import UserDetails from './UserDetails';
import Header from './Header';
import s from './index.module.less';
import CRMMonitoring from './UserDetails/CRMMonitoring';
import { useI18n } from '@/locales';
import PageWrapper, { PAGE_WRAPPER_PADDING } from '@/components/PageWrapper';
import { makeUrl } from '@/utils/routing';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { useQuery } from '@/utils/queries/hooks';
import { UI_SETTINGS } from '@/pages/users-item/ui-settings';
import { USERS_ITEM } from '@/utils/queries/keys';
import PageTabs, { TABS_LINE_HEIGHT } from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import AIInsightsCard from '@/pages/case-management-item/CaseDetails/AIInsightsCard';
import UserTransactionHistoryTable from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import CommentsCard from '@/components/CommentsCard';
import ExpectedTransactionLimits from '@/pages/users-item/UserDetails/BusinessUserDetails/TransactionLimits';
import InsightsCard from '@/pages/case-management-item/CaseDetails/InsightsCard';
import { useElementSize } from '@/utils/browser';
import AlertsCard from '@/pages/users-item/UserDetails/AlertsCard';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';

function UserItem() {
  const { list, id, tab = 'user-details' } = useParams<'list' | 'id' | 'tab'>(); // todo: handle nulls properly
  usePageViewTracker('User Item');
  const api = useApi();
  const measure = useApiTime();
  const queryClient = useQueryClient();
  const isMLDemoEnabled = useFeatureEnabled('MACHINE_LEARNING_DEMO');
  const isSalesForceEnabled = useFeatureEnabled('SALESFORCE');

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

  const navigate = useNavigate();

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);
  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(user) => (
        <>
          <Card.Root noBorder>
            <Header
              headerStickyElRef={setHeaderStickyElRef}
              user={user}
              onNewComment={handleNewComment}
            />
          </Card.Root>
          <PageTabs
            sticky={entityHeaderHeight}
            activeKey={tab}
            onTabClick={(newTab) => {
              navigate(
                keepBackUrl(makeUrl('/users/list/:list/:id/:tab', { id, list, tab: newTab })),
                {
                  replace: true,
                },
              );
            }}
          >
            {[
              {
                tab: 'User details',
                key: 'user-details',
                children: (
                  <UserDetails
                    user={user}
                    onUserUpdate={handleUserUpdate}
                    onReload={queryResult.refetch}
                    uiSettings={UI_SETTINGS}
                    hideExpectedTransactionLimits={true}
                    hideAIInsights={true}
                    showCommentEditor={false}
                  />
                ),
                isClosable: false,
                isDisabled: false,
              },
              {
                tab: 'Alerts',
                key: 'alerts',
                children: <AlertsCard userId={user.userId} />,
                isClosable: false,
                isDisabled: false,
              },
              ...(isSalesForceEnabled
                ? [
                    {
                      tab: (
                        <div className={s.icon}>
                          {' '}
                          <BrainIcon /> <span>&nbsp; CRM data</span>
                        </div>
                      ),
                      key: 'crm-monitoring',
                      children: <CRMMonitoring userId={user.userId} />,
                      isClosable: false,
                      isDisabled: false,
                    },
                  ]
                : []),
              ...(user.type === 'BUSINESS' && isMLDemoEnabled
                ? [
                    {
                      tab: 'AI merchant monitoring',
                      key: 'ai-insights',
                      children: <AIInsightsCard user={user} />,
                      isClosable: false,
                      isDisabled: false,
                    },
                  ]
                : []),
              {
                tab: 'Expected Transaction Limits',
                key: 'expected-transaction-limits',
                children: (
                  <Card.Root>
                    <ExpectedTransactionLimits user={user} />
                  </Card.Root>
                ),
                isClosable: false,
                isDisabled: false,
              },
              {
                tab: 'Transaction history',
                key: 'transaction-history',
                children: <UserTransactionHistoryTable userId={user.userId} />,
                isClosable: false,
                isDisabled: false,
              },
              {
                tab: 'Transaction Insights',
                key: 'transaction-insights',
                children: <InsightsCard userId={user.userId} />,
                isClosable: false,
                isDisabled: false,
              },
              {
                tab: 'Comments',
                key: 'comments',
                children: (
                  <CommentsCard
                    id={user.userId}
                    comments={user.comments ?? []}
                    onCommentsUpdate={(newComments) => {
                      handleUserUpdate({ ...user, comments: newComments });
                    }}
                    commentType={'USER'}
                  />
                ),
                isClosable: false,
                isDisabled: false,
              },
            ].map(({ tab, key, isDisabled, isClosable, children }) => (
              <AntTabs.TabPane
                key={key}
                tab={tab}
                closable={isClosable}
                disabled={isDisabled ?? false}
              >
                <div
                  className={s.sizeWrapper}
                  style={{
                    minHeight: `calc(100vh - ${
                      entityHeaderHeight + TABS_LINE_HEIGHT + PAGE_WRAPPER_PADDING
                    }px)`,
                  }}
                >
                  {children}
                </div>
              </AntTabs.TabPane>
            ))}
          </PageTabs>
        </>
      )}
    </AsyncResourceRenderer>
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
      <UserItem />
    </PageWrapper>
  );
}
