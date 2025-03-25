import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import ExpectedTransactionLimits from './UserDetails/shared/TransactionLimits';
import UserDetails from './UserDetails';
import Header from './Header';
import s from './index.module.less';
import CRMMonitoring from './UserDetails/CRMMonitoring';
import Linking from './UserDetails/Linking';
import { UserEvents } from './UserDetails/UserEvents';
import { CRM_ICON_MAP, useConsoleUser } from './UserDetails/utils';
import { useLinkingState, useUserEntityFollow } from './UserDetails/Linking/UserGraph';
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
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import UserActivityCard from '@/pages/users-item/UserDetails/UserActivityCard';
import { FormValues } from '@/components/CommentEditor';
import SanctionsWhitelist from '@/pages/users-item/UserDetails/SanctionsWhitelist';
import { CommentType } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';
import Alert from '@/components/library/Alert';

export default function UserItem() {
  const { list, id: userId, tab = 'user-details' } = useParams<'list' | 'id' | 'tab'>(); // todo: handle nulls properly
  const api = useApi();

  const queryClient = useQueryClient();
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');
  const settings = useSettings();
  const isCrmEnabled = useFeatureEnabled('CRM');

  const handleNewTags = (tags: UserTag[]) => {
    queryClient.setQueryData<InternalConsumerUser | InternalBusinessUser>(
      USERS_ITEM(userId),
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
        USERS_ITEM(userId),
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
        USERS_ITEM(userId),
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
        USERS_ITEM(userId),
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
    if (userId == null) {
      throw new Error(`User ID is not defined`);
    }
    const commentData = {
      CommentRequest: { body: commentFormValues.comment, files: commentFormValues.files },
    };
    return await api.postUsersCommentsReply({
      userId: userId,
      commentId: commentFormValues.parentCommentId ?? '',
      ...commentData,
    });
  };

  const navigate = useNavigate();

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);
  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;

  const queryResult = useConsoleUser(userId);
  const linkingState = useLinkingState(userId ?? '');
  const handleFollow = useUserEntityFollow(linkingState);

  if (userId == null) {
    return <Alert type={'ERROR'}>{`${firstLetterUpper(settings.userAlias)} id not defined`}</Alert>;
  }

  const userRes = queryResult.data;

  return (
    <PageWrapper
      disableHeaderPadding
      header={
        <Card.Root noBorder>
          <Header
            headerStickyElRef={setHeaderStickyElRef}
            userId={userId}
            userRes={userRes}
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
            keepBackUrl(makeUrl('/users/list/:list/:id/:tab', { id: userId, list, tab: newTab })),
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
            title: `${firstLetterUpper(settings.userAlias)} details`,
            key: 'user-details',
            children: <UserDetails userId={userId} onNewComment={handleNewComment} />,
            isClosable: false,
            isDisabled: false,
          },
          {
            title: `${firstLetterUpper(settings.userAlias)} events`,
            key: 'user-events',
            children: <UserEvents userId={userId} />,
          },
          {
            title: 'Alerts',
            key: 'alerts',
            children: <AlertsCard userId={userId} />,
            isClosable: false,
            isDisabled: false,
          },
          ...(isCrmEnabled && settings.crmIntegrationName
            ? [
                {
                  title: humanizeAuto(settings.crmIntegrationName),
                  key: 'crm-monitoring',
                  children: (
                    <AsyncResourceRenderer resource={userRes}>
                      {(user) => (
                        <CRMMonitoring
                          userId={user.userId}
                          userEmail={
                            user.type === 'CONSUMER'
                              ? user?.contactDetails?.emailIds?.[0] ?? ''
                              : user.legalEntity.contactDetails?.emailIds?.[0] ?? ''
                          }
                          user={user}
                          model={'FreshDeskTicket'}
                        />
                      )}
                    </AsyncResourceRenderer>
                  ),
                  isClosable: false,
                  isDisabled: false,
                  Icon: settings.crmIntegrationName
                    ? React.createElement(
                        CRM_ICON_MAP[settings.crmIntegrationName as keyof typeof CRM_ICON_MAP],
                      )
                    : null,
                  TrailIcon: (
                    <Tooltip title="Connected">
                      <div className={s.connected} />
                    </Tooltip>
                  ),
                },
              ]
            : []),
          ...(isEntityLinkingEnabled
            ? [
                {
                  title: <div className={s.icon}>Ontology</div>,
                  key: 'ontology',
                  children: (
                    <Linking
                      userId={userId}
                      scope={linkingState.scope}
                      onScopeChange={linkingState.setScope}
                      entityNodes={linkingState.entityNodes}
                      entityEdges={linkingState.entityEdges}
                      txnNodes={linkingState.txnNodes}
                      txnEdges={linkingState.txnEdges}
                      followed={linkingState.followed}
                      onFollow={handleFollow}
                      entityFilters={linkingState.entityFilters}
                      setEntityFilters={linkingState.setEntityFilters}
                      txnFilters={linkingState.txnFilters}
                      setTxnFilters={linkingState.setTxnFilters}
                    />
                  ),
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
                <AsyncResourceRenderer resource={userRes}>
                  {(user) => <ExpectedTransactionLimits user={user} />}
                </AsyncResourceRenderer>
              </Card.Root>
            ),
            isClosable: false,
            isDisabled: false,
          },
          {
            title: 'Transaction history',
            key: 'transaction-history',
            children: <UserTransactionHistoryTable userId={userId} />,
            isClosable: false,
            isDisabled: false,
          },
          {
            title: 'Transaction insights',
            key: 'transaction-insights',
            children: <InsightsCard userId={userId} />,
            isClosable: false,
            isDisabled: false,
            captureEvents: true,
          },
          {
            title: 'Activity',
            key: 'activity',
            children: (
              <AsyncResourceRenderer resource={userRes}>
                {(user) => (
                  <UserActivityCard
                    user={user}
                    comments={{
                      handleAddComment: handleAddCommentReply,
                      onCommentAdded: handleNewComment,
                    }}
                  />
                )}
              </AsyncResourceRenderer>
            ),
            isClosable: false,
            isDisabled: false,
          },
          ...(isSanctionsEnabled
            ? [
                {
                  title: 'Screening whitelist',
                  key: 'screening-whitelist',
                  children: (
                    <AsyncResourceRenderer resource={userRes}>
                      {(user) => <SanctionsWhitelist user={user} />}
                    </AsyncResourceRenderer>
                  ),
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
  );
}
