import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { isEmpty } from 'lodash';
import { useQueryClient } from '@tanstack/react-query';
import { firstLetterUpper, humanizeAuto } from '@flagright/lib/utils/humanize';
import AlertsCard from './AlertsCard';
import InsightsCard from './InsightsCard';
import { UI_SETTINGS } from './ui-settings';
import style from './index.module.less';
import { CaseTransactionsCard } from './CaseTransactionsCard';
import { EDDDetails } from './EDDDetails';
import NameDetailsCard from './NameDetailsCard';
import AddressDetailsCard from './AddressDetailsCard';
import EmailDetailsCard from './EmailDetailsCard';
import {
  Alert,
  AlertStatus,
  Case,
  CaseStatus,
  Comment as ApiComment,
  Comment,
  InternalBusinessUser,
  InternalConsumerUser,
} from '@/apis';
import UserDetails from '@/pages/users-item/UserDetails';
import { useScrollToFocus } from '@/utils/hooks';
import { ALERT_ITEM, ALERT_ITEM_COMMENTS, CASES_ITEM } from '@/utils/queries/keys';
import { useAlertsComments } from '@/hooks/api/alerts';
import {
  AsyncResource,
  getOr,
  isSuccess,
  success,
  useFinishedSuccessfully,
} from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
// import { useAuditLogsList } from '@/hooks/api/audit-logs';
import {
  useFeatureEnabled,
  useFreshdeskCrmEnabled,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import PageTabs from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import { makeUrl } from '@/utils/routing';
import { useElementSize } from '@/utils/browser';
import ExpectedTransactionLimits from '@/pages/users-item/UserDetails/shared/TransactionLimits';
import Linking from '@/pages/users-item/UserDetails/Linking';
import CRMRecords from '@/pages/users-item/UserDetails/CRMMonitoring/CRMRecords';
import { notEmpty } from '@/utils/array';
import { isExistedUser } from '@/utils/api/users';
import PaymentIdentifierDetailsCard from '@/pages/case-management-item/CaseDetails/PaymentIdentifierDetailsCard';
import ActivityCard, { getLogData } from '@/components/ActivityCard';
import { TabItem } from '@/components/library/Tabs';
import StatusFilterButton from '@/components/ActivityCard/Filters/StatusFilterButton';
import AlertIdSearchFilter from '@/components/ActivityCard/Filters/AlertIdSearchFIlter';
import ActivityByFilterButton from '@/components/ActivityCard/Filters/ActivityByFilterButton';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useUsers } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
import { ALERT_GROUP_PREFIX } from '@/utils/case-utils';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import Tooltip from '@/components/library/Tooltip';
import { CRM_ICON_MAP } from '@/pages/users-item/UserDetails/utils';
import CRMData from '@/pages/users-item/UserDetails/CRMMonitoring/CRMResponse';

export interface ActivityLogFilterParams {
  filterActivityBy?: string[];
  filterCaseStatus?: CaseStatus[];
  filterAlertStatus?: AlertStatus[];
  alertId?: string;
  case?: Case;
  user?: InternalConsumerUser | InternalBusinessUser;
}

export const DEFAULT_ACTIVITY_LOG_PARAMS: ActivityLogFilterParams = {
  filterActivityBy: undefined,
  filterCaseStatus: undefined,
  filterAlertStatus: undefined,
  alertId: undefined,
  case: undefined,
  user: undefined,
};

interface Props {
  caseId: string;
  caseItemRes: AsyncResource<Case>;
  expandedAlertId?: string;
  headerStickyElRef: HTMLDivElement | null;
  comments: CommentsHandlers;
}

interface CommentsHandlers {
  handleAddComment: (
    commentFormValues: CommentEditorFormValues,
    groupId: string,
  ) => Promise<ApiComment>;
  onCommentAdded: (newComment: Comment, groupId: string) => void;
}

function CaseDetails(props: Props) {
  const { caseId, caseItemRes, headerStickyElRef, expandedAlertId, comments } = props;
  useScrollToFocus();
  const navigate = useNavigate();
  const isEnhancedDueDiligenceEnabled = useFeatureEnabled('EDD_REPORT');
  const caseItem = getOr(caseItemRes, undefined);
  const alertIds = (caseItem?.alerts ?? [])
    .map(({ alertId }) => alertId)
    .filter((alertId): alertId is string => typeof alertId === 'string');
  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;
  const tabs = useTabs(caseItemRes, expandedAlertId, alertIds, comments);
  const { tab } = useParams<'list' | 'id' | 'tab'>();
  const activeTabKey =
    tab ?? tabs[0]?.key ?? (isEnhancedDueDiligenceEnabled ? 'enhanced-due-diligence' : '');

  return (
    <>
      <PageTabs
        sticky={entityHeaderHeight}
        activeKey={activeTabKey}
        onChange={(newTab) => {
          navigate(
            keepBackUrl(makeUrl('/case-management/case/:id/:tab', { id: caseId, tab: newTab })),
            { replace: true },
          );
        }}
        eventData={{
          page: 'case-details',
        }}
        items={tabs.map((tab) => ({
          ...tab,
          children: <>{tab.children}</>,
        }))}
      />
    </>
  );
}

function useAlertCommentGroups(caseRes: AsyncResource<Case>, alertIds: string[]) {
  const isJustLoaded = useFinishedSuccessfully(caseRes);
  const res = useAlertsComments(alertIds);
  return isJustLoaded ? success(getOr(res.data, [])) : res.data;
}

function useTabs(
  caseItemRes: AsyncResource<Case>,
  expandedAlertId: string | undefined,
  alertIds: string[],
  comments: CommentsHandlers,
): TabItem[] {
  const settings = useSettings();
  const api = useApi();
  const isCrmEnabled = useFeatureEnabled('CRM');
  const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');
  const isEnhancedDueDiligenceEnabled = useFeatureEnabled('EDD_REPORT');
  const alertCommentsRes = useAlertCommentGroups(caseItemRes, alertIds);
  const [users] = useUsers();
  const riskClassificationValues = useRiskClassificationScores();
  const queryClient = useQueryClient();
  const isFreshDeskCrmEnabled = useFreshdeskCrmEnabled();
  const caseItem = isSuccess(caseItemRes) ? caseItemRes.value : undefined;
  const entityIds = caseItem ? getEntityIds(caseItem) : [];
  const paymentDetails =
    caseItem?.paymentDetails?.origin ?? caseItem?.paymentDetails?.destination ?? undefined;
  const address = caseItem?.address?.origin ?? caseItem?.address?.destination ?? undefined;
  const email = caseItem?.email?.origin ?? caseItem?.email?.destination ?? undefined;
  const name = caseItem?.name?.origin ?? caseItem?.name?.destination ?? undefined;
  const user = caseItem?.caseUsers?.origin ?? caseItem?.caseUsers?.destination ?? undefined;

  const deleteCommentMutation = useMutation<
    unknown,
    unknown,
    { commentId: string; groupId: string }
  >(
    async (variables) => {
      if (!caseItem?.caseId) {
        throw new Error(`Case is null`);
      }
      const { commentId, groupId } = variables;
      if (groupId.startsWith(ALERT_GROUP_PREFIX)) {
        const parentId = groupId.replace(ALERT_GROUP_PREFIX, '');
        await api.deleteAlertsComment({ alertId: parentId, commentId });
      } else {
        await api.deleteCasesCaseIdCommentsCommentId({ caseId: caseItem.caseId, commentId });
      }
    },
    {
      onSuccess: (data, variables) => {
        message.success('Comment deleted successfully');
        const { commentId, groupId } = variables;
        if (groupId.startsWith(ALERT_GROUP_PREFIX)) {
          const alertId = groupId.replace(ALERT_GROUP_PREFIX, '');
          queryClient.setQueryData<Alert>(ALERT_ITEM(alertId), (alert) => {
            if (!alert) {
              return undefined;
            }
            return {
              ...alert,
              comments: (alert?.comments ?? []).filter((comment) => comment.id !== commentId),
            };
          });
          queryClient.setQueryData<ApiComment[]>(ALERT_ITEM_COMMENTS(alertId), (comments) => {
            if (comments == null) {
              return comments;
            }
            return comments.filter((comment) => comment.id !== commentId);
          });
        } else if (caseItem?.caseId) {
          queryClient.setQueryData<Case>(
            CASES_ITEM(caseItem.caseId),
            (caseItem: Case | undefined) => {
              if (caseItem == null) {
                return caseItem;
              }
              return {
                ...caseItem,
                comments: caseItem.comments?.filter((comment) => comment.id !== commentId),
              };
            },
          );
        }
      },
    },
  );
  const subjectType = caseItem?.subjectType ?? (isEmpty(user) ? 'PAYMENT' : 'USER');
  const isUserSubject = subjectType === 'USER';
  const isPaymentSubject = subjectType === 'PAYMENT';
  const isAddressSubject = subjectType === 'ADDRESS';
  const isEmailSubject = subjectType === 'EMAIL';
  const isNameSubject = subjectType === 'NAME';

  if (!caseItem) {
    return [];
  }

  return [
    ...(isEnhancedDueDiligenceEnabled
      ? [
          {
            title: 'Enhanced Due Diligence',
            key: 'enhanced-due-diligence',
            children: <EDDDetails userId={user?.userId ?? ''} />,
            isClosable: false,
            isDisabled: false,
          },
        ]
      : []),
    isPaymentSubject &&
      paymentDetails?.method && {
        title: 'Payment identifier details',
        key: 'payment-details',
        children: <PaymentIdentifierDetailsCard paymentDetails={paymentDetails} />,
        isClosable: false,
        isDisabled: false,
      },
    isAddressSubject &&
      address && {
        title: 'Address details',
        key: 'address-details',
        children: <AddressDetailsCard address={address} />,
        isClosable: false,
        isDisabled: false,
      },
    isEmailSubject &&
      email && {
        title: 'Email details',
        key: 'email-details',
        children: <EmailDetailsCard email={email} />,
        isClosable: false,
        isDisabled: false,
      },
    isNameSubject &&
      name && {
        title: 'Name details',
        key: 'name-details',
        children: <NameDetailsCard name={name} />,
        isClosable: false,
        isDisabled: false,
      },
    isUserSubject && {
      title: `${firstLetterUpper(settings.userAlias)} details`,
      key: 'user-details',
      children: <UserDetails userId={user?.userId} />,
      isClosable: false,
      isDisabled: false,
    },
    caseItem &&
      caseItem?.caseType !== 'MANUAL' && {
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
    caseItem &&
      caseItem.caseId &&
      user &&
      caseItem.caseType === 'MANUAL' &&
      !isEnhancedDueDiligenceEnabled && {
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
      isCrmEnabled &&
      settings.crmIntegrationName &&
      !isEnhancedDueDiligenceEnabled && {
        title: humanizeAuto(settings.crmIntegrationName),
        key: 'crm-records',
        children: user.userId ? (
          isFreshDeskCrmEnabled ? (
            <CRMRecords userId={user.userId} />
          ) : (
            <CRMData userId={user.userId} />
          )
        ) : undefined,
        isClosable: false,
        isDisabled: false,
        Icon: settings.crmIntegrationName
          ? React.createElement(
              CRM_ICON_MAP[settings.crmIntegrationName as keyof typeof CRM_ICON_MAP],
              { className: style.crmIcon },
            )
          : null,
        TrailIcon: (
          <Tooltip title="Connected">
            <div className={style.connected} />
          </Tooltip>
        ),
      },
    isUserSubject &&
      user &&
      isEntityLinkingEnabled &&
      !isEnhancedDueDiligenceEnabled && {
        title: <div className={style.icon}>Ontology</div>,
        key: 'ontology',
        children: user.userId ? <Linking userId={user.userId} /> : undefined,
        isClosable: false,
        isDisabled: false,
        captureEvents: true,
      },
    isUserSubject &&
      user?.userId &&
      !isEnhancedDueDiligenceEnabled && {
        title: 'Transaction insights',
        key: 'transaction-insights',
        children: (
          <InsightsCard userId={user.userId} title={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.title} />
        ),
        isClosable: false,
        captureEvents: true,
        isDisabled: false,
      },
    isExistedUser(user) &&
      !isEnhancedDueDiligenceEnabled && {
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
              defaultActivityLogParams={DEFAULT_ACTIVITY_LOG_PARAMS}
              logs={{
                request: async (params) => {
                  const { alertId, filterActivityBy, filterCaseStatus, filterAlertStatus } = params;
                  const response = await api.getAuditlog({
                    sortField: 'timestamp',
                    sortOrder: 'descend',
                    searchEntityId: alertId ? [alertId] : entityIds,
                    filterActions: ['CREATE', 'UPDATE', 'ESCALATE', 'DELETE'],
                    filterActionTakenBy: filterActivityBy,
                    caseStatus: filterCaseStatus,
                    alertStatus: filterAlertStatus,
                    includeRootUserRecords: true,
                    pageSize: 100,
                    entityIdExactMatch: true,
                  });
                  return getLogData(response.data, users, 'CASE', riskClassificationValues);
                },
                filters: ([params, setParams]) => (
                  <>
                    <StatusFilterButton
                      initialState={params?.filterCaseStatus ?? []}
                      onConfirm={(value) => {
                        setParams((prevState) => ({
                          ...prevState,
                          filterCaseStatus: value,
                        }));
                      }}
                      title={'Case status'}
                    />
                    <AlertIdSearchFilter
                      initialState={params?.alertId}
                      onConfirm={(value) => {
                        setParams((prevState) => ({
                          ...prevState,
                          alertId: value,
                        }));
                      }}
                    />
                    <StatusFilterButton
                      initialState={params?.filterAlertStatus ?? []}
                      onConfirm={(value) => {
                        setParams((prevState) => ({
                          ...prevState,
                          filterAlertStatus: value,
                        }));
                      }}
                      title={'Alert status'}
                    />
                    <ActivityByFilterButton
                      initialState={params?.filterActivityBy ?? []}
                      onConfirm={(value) => {
                        setParams((prevState) => ({
                          ...prevState,
                          filterActivityBy: value,
                        }));
                      }}
                    />
                  </>
                ),
              }}
              comments={{
                writeResources: ['write:::case-management/case-details/*'],
                handleAddComment: comments.handleAddComment,
                onCommentAdded: (newComment, _, groupId) => {
                  return comments.onCommentAdded(newComment, groupId);
                },
                deleteCommentMutation: deleteCommentMutation,
                dataRes: success([
                  ...alertCommentsGroups,
                  {
                    title: 'Case comments',
                    id: caseItem?.caseId ?? '-',
                    comments: caseItem?.comments ?? [],
                  },
                ]),
              }}
            />
          )}
        </AsyncResourceRenderer>
      ),
      isClosable: false,
      isDisabled: false,
    },
  ].filter(notEmpty);
}

export function getEntityIds(caseItem?: Case): string[] {
  const ids = new Set<string | undefined>();
  if (caseItem) {
    ids.add(caseItem?.caseId);
    caseItem?.alerts?.forEach((alert) => {
      ids.add(alert.alertId);
    });
  }
  return [...ids].filter(notEmpty);
}

export default CaseDetails;
