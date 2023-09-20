import React from 'react';
import { Tabs as AntTabs } from 'antd';
import { useNavigate, useParams } from 'react-router';
import AIInsightsCard from './AIInsightsCard';
import { CommentGroup } from './CommentsCard';
import AlertsCard from './AlertsCard';
import InsightsCard from './InsightsCard';
import { UI_SETTINGS } from './ui-settings';
import style from './index.module.less';
import { CaseTransactionsCard } from './CaseTransactionsCard';
import { Comment as ApiComment, Case, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import UserDetails from '@/pages/users-item/UserDetails';
import { useScrollToFocus } from '@/utils/hooks';
import { useQueries } from '@/utils/queries/hooks';
import { ALERT_ITEM_COMMENTS } from '@/utils/queries/keys';
import { all, AsyncResource, map } from '@/utils/asyncResource';
import { QueryResult } from '@/utils/queries/types';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import PageTabs, { TABS_LINE_HEIGHT } from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { PAGE_WRAPPER_PADDING } from '@/components/PageWrapper';
import { useElementSize } from '@/utils/browser';
import ExpectedTransactionLimits from '@/pages/users-item/UserDetails/BusinessUserDetails/TransactionLimits';
import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
import Linking from '@/pages/users-item/UserDetails/Linking';
import Tooltip from '@/components/library/Tooltip';
import { getBranding } from '@/utils/branding';
import CRMMonitoring from '@/pages/users-item/UserDetails/CRMMonitoring';
import ActivityCard from '@/components/ActivityCard';

interface Props {
  caseItem: Case;
  onReload: () => void;
  headerStickyElRef: HTMLDivElement | null;
}

function CaseDetails(props: Props) {
  const { tab = 'user-details' } = useParams<'list' | 'id' | 'tab'>();
  const { caseItem, headerStickyElRef } = props;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;
  useScrollToFocus();
  const settings = useSettings();
  const isMerchantMonitoringEnabled = useFeatureEnabled('MERCHANT_MONITORING');
  const navigate = useNavigate();
  const isCrmEnabled = useFeatureEnabled('CRM');
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');

  const alertIds = (caseItem.alerts ?? [])
    .map(({ alertId }) => alertId)
    .filter((alertId): alertId is string => typeof alertId === 'string');

  const alertCommentsRes = useAlertsComments(alertIds);
  const branding = getBranding();

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
            { replace: true },
          );
        }}
      >
        {[
          {
            tab: 'User details',
            key: 'user-details',
            children: <UserDetails user={user} uiSettings={UI_SETTINGS} />,
            isClosable: false,
            isDisabled: false,
          },
          ...(caseItem.caseType === 'SYSTEM'
            ? [
                {
                  tab: 'Alerts',
                  key: 'alerts',
                  children: (
                    <AlertsCard caseItem={caseItem} title={UI_SETTINGS.cards.ALERTS.title} />
                  ),
                  isClosable: false,
                  isDisabled: false,
                },
              ]
            : []),
          ...(caseItem.caseId && user && caseItem.caseType === 'MANUAL'
            ? [
                {
                  tab: 'Case transactions',
                  key: 'case-transactions',
                  children: (
                    <CaseTransactionsCard
                      caseId={caseItem.caseId}
                      caseTransactionsCount={caseItem.caseTransactionsCount ?? 0}
                      caseType={caseItem.caseType}
                      user={user}
                    />
                  ),
                  isClosable: false,
                  isDisabled: false,
                },
              ]
            : []),
          ...(user && isCrmEnabled
            ? [
                {
                  tab: (
                    <div className={style.icon}>
                      {' '}
                      <BrainIcon /> <span>&nbsp; CRM data</span>
                    </div>
                  ),
                  key: 'crm-monitoring',
                  children: <CRMMonitoring userId={user.userId!} />,
                  isClosable: false,
                  isDisabled: false,
                },
              ]
            : []),
          ...(user && isEntityLinkingEnabled
            ? [
                {
                  tab: <div className={style.icon}>Entity linking</div>,
                  key: 'entity-linking',
                  children: <Linking userId={user.userId!} />,
                  isClosable: false,
                  isDisabled: false,
                },
              ]
            : []),
          ...(user && 'type' in user && user?.type === 'BUSINESS' && isMerchantMonitoringEnabled
            ? [
                {
                  tab: !settings.isAiEnabled ? (
                    <Tooltip
                      title={`You need to enable ${branding.companyName} AI Features under Settings to view this tab`}
                    >
                      <div className={style.icon}>
                        <BrainIcon /> <span>&nbsp; Merchant monitoring</span>
                      </div>
                    </Tooltip>
                  ) : (
                    <div className={style.icon}>
                      <BrainIcon /> <span>&nbsp; Merchant monitoring</span>
                    </div>
                  ),

                  key: 'ai-merchant-monitoring',
                  children: <AIInsightsCard user={user as InternalBusinessUser} />,
                  isClosable: false,
                  isDisabled: !settings.isAiEnabled,
                },
              ]
            : []),
          ...(user?.userId
            ? [
                {
                  tab: 'Transaction insights',
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
            tab: 'Expected transaction limits',
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
            tab: 'Activity',
            key: 'activity',
            children: (
              <AsyncResourceRenderer resource={alertCommentsRes}>
                {(alertCommentsGroups) => (
                  <ActivityCard
                    caseItems={[caseItem]}
                    user={user as InternalBusinessUser | InternalConsumerUser}
                    comments={[
                      ...alertCommentsGroups,
                      {
                        title: 'Other comments',
                        type: 'CASE',
                        id: caseItem.caseId ?? '-',
                        comments: caseItem.comments ?? [],
                      },
                    ]}
                    type="CASE"
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
