import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import UserDetails from './UserDetails';
import Header from './Header';
import s from './index.module.less';
import CRMMonitoring from './UserDetails/CRMMonitoring';
import Linking from './UserDetails/Linking';
import { UserEvents } from './UserDetails/UserEvents';
import PageWrapper, { PAGE_WRAPPER_PADDING } from '@/components/PageWrapper';
import { makeUrl } from '@/utils/routing';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import { useQuery } from '@/utils/queries/hooks';
import { UI_SETTINGS } from '@/pages/users-item/ui-settings';
import { USERS_ITEM } from '@/utils/queries/keys';
import PageTabs, { TABS_LINE_HEIGHT } from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import AIInsightsCard from '@/pages/case-management-item/CaseDetails/AIInsightsCard';
import UserTransactionHistoryTable from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import ExpectedTransactionLimits from '@/pages/users-item/UserDetails/BusinessUserDetails/TransactionLimits';
import InsightsCard from '@/pages/case-management-item/CaseDetails/InsightsCard';
import { useElementSize } from '@/utils/browser';
import AlertsCard from '@/pages/users-item/UserDetails/AlertsCard';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import UserActivityCard from '@/pages/users-item/UserDetails/UserActivityCard';
import { FormValues } from '@/components/CommentEditor';

export default function UserItem() {
  const { list, id, tab = 'user-details' } = useParams<'list' | 'id' | 'tab'>(); // todo: handle nulls properly
  const api = useApi();

  const queryClient = useQueryClient();
  const isMerchantMonitoringEnabled = useFeatureEnabled('MERCHANT_MONITORING');
  const isCrmEnabled = useFeatureEnabled('CRM');
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');

  const queryResult = useQuery<InternalConsumerUser | InternalBusinessUser>(USERS_ITEM(id), () => {
    if (id == null) {
      throw new Error(`Id is not defined`);
    }
    return api.getUsersItem({ userId: id });
  });

  const handleNewComment = (newComment: Comment) => {
    queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
      USERS_ITEM(id),
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

  const handleAddCommentReply = async (commentFormValues: FormValues) => {
    if (id == null) {
      throw new Error(`User ID is not defined`);
    }
    const commentData = {
      Comment: { body: commentFormValues.comment, files: commentFormValues.files },
    };
    return await api.postUsersCommentsReply({
      userId: id,
      commentId: commentFormValues.parentCommentId ?? '',
      ...commentData,
    });
  };

  const navigate = useNavigate();

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);
  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(user) => (
        <PageWrapper
          disableHeaderPadding
          header={
            <Card.Root noBorder>
              <Header
                headerStickyElRef={setHeaderStickyElRef}
                user={user}
                onNewComment={handleNewComment}
              />
            </Card.Root>
          }
        >
          <PageTabs
            sticky={entityHeaderHeight}
            activeKey={tab}
            onChange={(newTab) => {
              navigate(
                keepBackUrl(makeUrl('/users/list/:list/:id/:tab', { id, list, tab: newTab })),
                {
                  replace: true,
                },
              );
            }}
            eventData={{
              page: 'user-details',
            }}
            items={[
              {
                title: 'User details',
                key: 'user-details',
                children: <UserDetails user={user} uiSettings={UI_SETTINGS} />,
                isClosable: false,
                isDisabled: false,
              },
              {
                title: 'User events',
                key: 'user-events',
                children: <UserEvents userId={user.userId} />,
              },
              {
                title: 'Alerts',
                key: 'alerts',
                children: <AlertsCard userId={user.userId} />,
                isClosable: false,
                isDisabled: false,
              },
              ...(isCrmEnabled
                ? [
                    {
                      title: (
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
              ...(isEntityLinkingEnabled
                ? [
                    {
                      title: <div className={s.icon}>Ontology</div>,
                      key: 'ontology',
                      children: <Linking userId={user.userId} />,
                      isClosable: false,
                      isDisabled: false,
                      captureEvents: true,
                    },
                  ]
                : []),
              ...(user.type === 'BUSINESS' && isMerchantMonitoringEnabled
                ? [
                    {
                      title: (
                        <div className={s.icon}>
                          {' '}
                          <BrainIcon /> <span>&nbsp; Merchant monitoring</span>
                        </div>
                      ),
                      key: 'ai-merchant-monitoring',
                      children: <AIInsightsCard user={user} />,
                      isClosable: false,
                      isDisabled: false,
                    },
                  ]
                : []),
              {
                title: 'Expected transaction limits',
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
                title: 'Transaction history',
                key: 'transaction-history',
                children: <UserTransactionHistoryTable userId={user.userId} />,
                isClosable: false,
                isDisabled: false,
              },
              {
                title: 'Transaction insights',
                key: 'transaction-insights',
                children: <InsightsCard userId={user.userId} />,
                isClosable: false,
                isDisabled: false,
                captureEvents: true,
              },
              {
                title: 'Activity',
                key: 'activity',
                children: (
                  <UserActivityCard
                    user={user}
                    comments={{
                      handleAddComment: handleAddCommentReply,
                      onCommentAdded: handleNewComment,
                    }}
                  />
                ),
                isClosable: false,
                isDisabled: false,
              },
            ].map((item) => ({
              ...item,
              children: (
                <div
                  className={s.sizeWrapper}
                  style={{
                    minHeight: `calc(100vh - ${
                      entityHeaderHeight + TABS_LINE_HEIGHT + PAGE_WRAPPER_PADDING
                    }px)`,
                  }}
                >
                  {item.children}
                </div>
              ),
            }))}
          />
        </PageWrapper>
      )}
    </AsyncResourceRenderer>
  );
}
