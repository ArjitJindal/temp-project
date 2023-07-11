import React from 'react';
import { Tabs as AntTabs } from 'antd';
import { useNavigate, useParams } from 'react-router';
import AIInsightsCard from './AIInsightsCard';
import CommentsCard, { CommentGroup } from './CommentsCard';
import AlertsCard from './AlertsCard';
import InsightsCard from './InsightsCard';
import { UI_SETTINGS } from './ui-settings';
import { Comment as ApiComment, Case, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import UserDetails from '@/pages/users-item/UserDetails';
import { usePageViewTracker } from '@/utils/tracker';
import { useScrollToFocus } from '@/utils/hooks';
import { useQueries } from '@/utils/queries/hooks';
import { ALERT_ITEM_COMMENTS } from '@/utils/queries/keys';
import { all, AsyncResource, map } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import PageTabs, { TABS_LINE_HEIGHT } from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { PAGE_WRAPPER_PADDING } from '@/components/PageWrapper';
import { useElementSize } from '@/utils/browser';
import ExpectedTransactionLimits from '@/pages/users-item/UserDetails/BusinessUserDetails/TransactionLimits';

interface Props {
  caseItem: Case;
  updateCollapseState?: (key: string, value: boolean) => void;
  onReload: () => void;
  headerStickyElRef: HTMLDivElement | null;
}

function CaseDetails(props: Props) {
  const { tab = 'user-details' } = useParams<'list' | 'id' | 'tab'>();
  const { caseItem, headerStickyElRef } = props;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;
  usePageViewTracker('User Case Details');
  useScrollToFocus();
  const isMLDemoEnabled = useFeatureEnabled('MACHINE_LEARNING_DEMO');
  const navigate = useNavigate();

  const alertIds = (caseItem.alerts ?? [])
    .map(({ alertId }) => alertId)
    .filter((alertId): alertId is string => typeof alertId === 'string');
  const alertCommentsRes = useAlertsComments(alertIds);

  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;
  return (
    <>
      <PageTabs
        sticky={entityHeaderHeight}
        activeKey={tab}
        onTabClick={(newTab) => {
          navigate(
            keepBackUrl(
              makeUrl('/case-management/case/:id/:tab', { id: caseItem.caseId, tab: newTab }),
            ),
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
                onReload={props.onReload}
                showCommentEditor={false}
                uiSettings={UI_SETTINGS}
                hideAIInsights={true}
                hideExpectedTransactionLimits={true}
              />
            ),
            isClosable: false,
            isDisabled: false,
          },
          {
            tab: 'Alerts',
            key: 'alerts',
            children: <AlertsCard caseItem={caseItem} title={UI_SETTINGS.cards.ALERTS.title} />,
            isClosable: false,
            isDisabled: false,
          },
          ...(user && 'type' in user && user?.type === 'BUSINESS' && isMLDemoEnabled
            ? [
                {
                  tab: 'AI Insights',
                  key: 'ai-insights',
                  children: <AIInsightsCard user={user as InternalBusinessUser} />,
                  isClosable: false,
                  isDisabled: false,
                },
              ]
            : []),
          ...(user?.userId
            ? [
                {
                  tab: 'Transaction Insights',
                  key: 'transaction-insights',
                  children: (
                    <InsightsCard
                      userId={user.userId}
                      title={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.title}
                    />
                  ),
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
                <ExpectedTransactionLimits
                  user={user as InternalBusinessUser | InternalConsumerUser}
                />
              </Card.Root>
            ),
            isClosable: false,
            isDisabled: false,
          },
          {
            tab: 'Comments',
            key: 'comments',
            children: (
              <AsyncResourceRenderer resource={alertCommentsRes}>
                {(alertCommentsGroups) => (
                  <CommentsCard
                    id={caseItem.caseId}
                    comments={[
                      ...alertCommentsGroups,
                      {
                        title: 'Other comments',
                        type: 'CASE',
                        id: caseItem.caseId ?? '-',
                        comments: caseItem.comments ?? [],
                      },
                    ]}
                    title={UI_SETTINGS.cards.COMMENTS.title}
                  />
                )}
              </AsyncResourceRenderer>
            ),
            isClosable: false,
            isDisabled: false,
          },
        ].map(({ tab, key, isDisabled, isClosable, children }) => (
          <AntTabs.TabPane key={key} tab={tab} closable={isClosable} disabled={isDisabled ?? false}>
            <div
              // className={s.sizeWrapper}
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
  );
}

function useAlertsComments(alertIds: string[]): AsyncResource<CommentGroup[]> {
  const api = useApi();

  const results = useQueries<ApiComment[]>({
    queries: alertIds.map((alertId) => ({
      queryKey: ALERT_ITEM_COMMENTS(alertId),
      queryFn: async (): Promise<ApiComment[]> => {
        const alert = await api.getAlert({
          alertId: alertId,
        });
        return alert.comments ?? [];
      },
    })),
  });

  const commentsResources: AsyncResource<CommentGroup>[] = results.map(
    (x: QueryResult<ApiComment[]>, i): AsyncResource<CommentGroup> => {
      const alertId = alertIds[i];
      return map(x.data, (comments: ApiComment[]) => ({
        title: `Alert: ${alertId}`,
        id: alertId ?? '',
        type: 'ALERT',
        comments,
      }));
    },
  );

  return all(commentsResources);
}

export default CaseDetails;
