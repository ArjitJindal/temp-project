import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import ExpectedTransactionLimits from './UserDetails/shared/TransactionLimits';
import UserDetails from './UserDetails';
import Header from './Header';
import s from './index.module.less';
import CRMMonitoring from './UserDetails/CRMMonitoring';
import Linking from './UserDetails/Linking';
import { UserEvents } from './UserDetails/UserEvents';
import { useConsoleUser } from './UserDetails/utils';
import PageWrapper, { PAGE_WRAPPER_PADDING } from '@/components/PageWrapper';
import { makeUrl } from '@/utils/routing';
import {
  Comment,
  InternalBusinessUser,
  InternalConsumerUser,
  PersonAttachment,
  UserTag,
} from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import { USERS_ITEM } from '@/utils/queries/keys';
import PageTabs, { TABS_LINE_HEIGHT } from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import UserTransactionHistoryTable from '@/pages/users-item/UserDetails/UserTransactionHistoryTable';
import InsightsCard from '@/pages/case-management-item/CaseDetails/InsightsCard';
import { useElementSize } from '@/utils/browser';
import AlertsCard from '@/pages/users-item/UserDetails/AlertsCard';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import UserActivityCard from '@/pages/users-item/UserDetails/UserActivityCard';
import { FormValues } from '@/components/CommentEditor';
import SanctionsWhitelist from '@/pages/users-item/UserDetails/SanctionsWhitelist';
import { CommentType } from '@/utils/user-utils';

export default function UserItem() {
  const { list, id, tab = 'user-details' } = useParams<'list' | 'id' | 'tab'>(); // todo: handle nulls properly
  const api = useApi();

  const queryClient = useQueryClient();
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const isCrmEnabled = useFeatureEnabled('CRM');
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');

  const handleNewTags = (tags: UserTag[]) => {
    queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
      USERS_ITEM(id),
      (user) => {
        if (user == null) {
          return user;
        }
        return {
          ...user,
          tags: tags,
        };
      },
    );
  };

  const handleNewComment = (newComment: Comment, commentType: CommentType, personId?: string) => {
    if (commentType === CommentType.COMMENT) {
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
    }
    if (commentType === CommentType.USER) {
      queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
        USERS_ITEM(id),
        (user) => {
          if (user == null) {
            return user;
          }
          return {
            ...user,
            comments: [...(user?.comments ?? []), newComment],
            attachments: [...(user?.attachments ?? []), newComment as PersonAttachment],
          };
        },
      );
    }
    if (commentType === CommentType.SHAREHOLDERDIRECTOR && personId) {
      queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
        USERS_ITEM(id),
        (user) => {
          if (user == null) {
            return user;
          }
          return {
            ...user,
            comments: [...(user?.comments ?? []), newComment],
            shareHolders: (user as InternalBusinessUser).shareHolders?.map((shareHolder) => {
              if (shareHolder.userId === personId) {
                return shareHolder;
              }
              return {
                ...shareHolder,
                attachments: [...(shareHolder.attachments ?? []), newComment as PersonAttachment],
              };
            }),
            directors: (user as InternalBusinessUser).directors?.map((director) => {
              if (director.userId === personId) {
                return director;
              }
              return {
                ...director,
                attachments: [...(director.attachments ?? []), newComment as PersonAttachment],
              };
            }),
          };
        },
      );
    }
  };

  const handleAddCommentReply = async (commentFormValues: FormValues) => {
    if (id == null) {
      throw new Error(`User ID is not defined`);
    }
    const commentData = {
      CommentRequest: { body: commentFormValues.comment, files: commentFormValues.files },
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

  const queryResult = useConsoleUser(id);

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
                onNewTags={handleNewTags}
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
                children: <UserDetails userId={user.userId} onNewComment={handleNewComment} />,
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
              ...(isSanctionsEnabled
                ? [
                    {
                      title: 'Screening whitelist',
                      key: 'screening-whitelist',
                      children: <SanctionsWhitelist user={user} />,
                      isClosable: false,
                      isDisabled: false,
                    },
                  ]
                : []),
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
