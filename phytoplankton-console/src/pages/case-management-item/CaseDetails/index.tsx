import React from 'react';
import { useNavigate, useParams } from 'react-router';
import AIInsightsCard from './AIInsightsCard';
import { CommentGroup } from './CommentsCard';
import AlertsCard from './AlertsCard';
import InsightsCard from './InsightsCard';
import { UI_SETTINGS } from './ui-settings';
import style from './index.module.less';
import { CaseTransactionsCard } from './CaseTransactionsCard';
import { Case, Comment as ApiComment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
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
import { notEmpty } from '@/utils/array';
import { isExistedUser } from '@/utils/api/users';
import PaymentIdentifierDetailsCard from '@/pages/case-management-item/CaseDetails/PaymentIdentifierDetailsCard';
import ActivityCard from '@/components/ActivityCard';
import { TabItem } from '@/components/library/Tabs';

interface Props {
  caseItem: Case;
  expandedAlertId?: string;
  onReload: () => void;
  headerStickyElRef: HTMLDivElement | null;
}

function CaseDetails(props: Props) {
  const { caseItem, headerStickyElRef, expandedAlertId } = props;
  useScrollToFocus();
  const navigate = useNavigate();

  const alertIds = (caseItem.alerts ?? [])
    .map(({ alertId }) => alertId)
    .filter((alertId): alertId is string => typeof alertId === 'string');
  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;
  const tabs = useTabs(caseItem, expandedAlertId, alertIds);
  const { tab = tabs[0].key } = useParams<'list' | 'id' | 'tab'>();
  return (
    <>
      <PageTabs
        sticky={entityHeaderHeight}
        activeKey={tab}
        onChange={(newTab) => {
          navigate(
            keepBackUrl(
              makeUrl('/case-management/case/:id/:tab', { id: caseItem.caseId, tab: newTab }),
            ),
            { replace: true },
          );
        }}
        items={tabs.map((tab) => ({
          ...tab,
          children: (
            <div
              style={{
                minHeight: `calc(100vh - ${
                  entityHeaderHeight + TABS_LINE_HEIGHT + PAGE_WRAPPER_PADDING
                }px)`,
              }}
            >
              {tab.children}
            </div>
          ),
        }))}
      />
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

export function useTabs(
  caseItem: Case,
  expandedAlertId: string | undefined,
  alertIds: string[],
): TabItem[] {
  const { subjectType = 'USER' } = caseItem;
  const isCrmEnabled = useFeatureEnabled('CRM');
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');
  const isUserSubject = subjectType === 'USER';
  const isPaymentSubject = subjectType === 'PAYMENT';
  const paymentDetails =
    caseItem.paymentDetails?.origin ?? caseItem.paymentDetails?.destination ?? undefined;
  const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;
  const settings = useSettings();
  const isMerchantMonitoringEnabled = useFeatureEnabled('MERCHANT_MONITORING');
  const branding = getBranding();
  const alertCommentsRes = useAlertsComments(alertIds);
  return [
    isPaymentSubject && {
      title: 'Payment identifier details',
      key: 'payment-details',
      children: <PaymentIdentifierDetailsCard paymentDetails={paymentDetails} />,
      isClosable: false,
      isDisabled: false,
    },
    isUserSubject && {
      title: 'User details',
      key: 'user-details',
      children: <UserDetails user={user} uiSettings={UI_SETTINGS} />,
      isClosable: false,
      isDisabled: false,
    },
    caseItem.caseType === 'SYSTEM' && {
      title: 'Alerts',
      key: 'alerts',
      children: (
        <AlertsCard
          caseItem={caseItem}
          expandedAlertId={expandedAlertId}
          title={UI_SETTINGS.cards.ALERTS.title}
        />
      ),
      isClosable: false,
      isDisabled: false,
    },
    caseItem.caseId &&
      user &&
      caseItem.caseType === 'MANUAL' && {
        title: 'Case transactions',
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
    user &&
      isCrmEnabled && {
        title: (
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
    isUserSubject &&
      user &&
      isEntityLinkingEnabled && {
        title: <div className={style.icon}>Entity linking</div>,
        key: 'entity-linking',
        children: <Linking userId={user.userId!} />,
        isClosable: false,
        isDisabled: false,
      },
    isUserSubject &&
      user &&
      'type' in user &&
      user?.type === 'BUSINESS' &&
      isMerchantMonitoringEnabled && {
        title: !settings.isAiEnabled ? (
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
    isUserSubject &&
      user?.userId && {
        title: 'Transaction insights',
        key: 'transaction-insights',
        children: (
          <InsightsCard userId={user.userId} title={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.title} />
        ),
        isClosable: false,
        isDisabled: false,
      },
    isExistedUser(user) && {
      title: 'Expected transaction limits',
      key: 'expected-transaction-limits',
      children: (
        <Card.Root>
          <ExpectedTransactionLimits user={user as InternalBusinessUser | InternalConsumerUser} />
        </Card.Root>
      ),
      isClosable: false,
      isDisabled: false,
    },
    {
      title: 'Activity',
      key: 'activity',
      children: (
        <AsyncResourceRenderer resource={alertCommentsRes}>
          {(alertCommentsGroups) => (
            <ActivityCard
              caseItem={caseItem}
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
  ].filter(notEmpty);
}
export default CaseDetails;
