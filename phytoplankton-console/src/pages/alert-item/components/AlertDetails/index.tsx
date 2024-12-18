import React from 'react';
// import { flatten } from 'lodash';
// import { useQueryClient } from '@tanstack/react-query';
// import AlertsCard from './AlertsCard';
// import InsightsCard from './InsightsCard';
// import { UI_SETTINGS } from './ui-settings';
// import style from './index.module.less';
// import { CaseTransactionsCard } from './CaseTransactionsCard';
// import CaseIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import AlertDetailsTabs from 'src/pages/alert-item/components/AlertDetails/AlertDetailsTabs';
import { Alert, Case, Comment as ApiComment } from '@/apis';
// import UserDetails from '@/pages/users-item/UserDetails';
// import { useScrollToFocus } from '@/utils/hooks';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM } from '@/utils/queries/keys';
// import { all, AsyncResource, getOr, map, success } from '@/utils/asyncResource';
// import { QueryResult } from '@/utils/queries/types';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
// import * as Card from '@/components/ui/Card';
import { useApi } from '@/api';
// import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
// import PageTabs, { TABS_LINE_HEIGHT } from '@/components/ui/PageTabs';
// import { keepBackUrl } from '@/utils/backUrl';
// import { makeUrl } from '@/utils/routing';
// import { PAGE_WRAPPER_PADDING } from '@/components/PageWrapper';
// import { useElementSize } from '@/utils/browser';
// import ExpectedTransactionLimits from '@/pages/users-item/UserDetails/shared/TransactionLimits';
// import BrainIcon from '@/components/ui/icons/brain-icon.react.svg';
// import Linking from '@/pages/users-item/UserDetails/Linking';
// import CRMMonitoring from '@/pages/users-item/UserDetails/CRMMonitoring';
// import { notEmpty } from '@/utils/array';
// import { isExistedUser } from '@/utils/api/users';
// import PaymentIdentifierDetailsCard from '@/pages/case-management-item/CaseDetails/PaymentIdentifierDetailsCard';
// import ActivityCard from '@/components/ActivityCard';
// import { TabItem } from '@/components/library/Tabs';
// import StatusFilterButton from '@/components/ActivityCard/Filters/StatusFilterButton';
// import AlertIdSearchFilter from '@/components/ActivityCard/Filters/AlertIdSearchFIlter';
// import ActivityByFilterButton from '@/components/ActivityCard/Filters/ActivityByFilterButton';
// import { useMutation } from '@/utils/queries/mutations/hooks';
// import { LogItemData } from '@/components/ActivityCard/LogCard/LogContainer/LogItem';
// import {
//   getCreateStatement,
//   isActionCreate,
//   isActionDelete,
//   isActionEscalate,
//   isActionUpdate,
// } from '@/components/ActivityCard/helpers';
// import { useUsers } from '@/utils/user-utils';
// import Avatar from '@/components/library/Avatar';
// import { CommentGroup } from '@/components/CommentsCard';
// import { message } from '@/components/library/Message';
import { FormValues as CommentEditorFormValues } from '@/components/CommentEditor';
// import { ALERT_GROUP_PREFIX } from '@/utils/case-utils';
// import { useRiskClassificationScores } from '@/utils/risk-levels';

interface CommentsHandlers {
  handleAddComment: (
    commentFormValues: CommentEditorFormValues,
    groupId: string,
  ) => Promise<ApiComment>;
  onCommentAdded: (newComment: ApiComment, groupId: string) => void;
}

interface Props {
  // caseItem: Case;
  alertItem: Alert;
  headerStickyElRef: HTMLDivElement | null;
  comments: CommentsHandlers;
}

function AlertDetails(props: Props) {
  const { alertItem } = props;
  // useScrollToFocus();

  const api = useApi();

  const { caseId } = alertItem;
  const caseQueryResults = useQuery(CASES_ITEM(caseId ?? ''), (): Promise<Case> => {
    if (caseId == null) {
      throw new Error(`Alert case id could not be empty`);
    }
    return api.getCase({ caseId });
  });

  // const navigate = useNavigate();

  // const alertIds = (caseItem.alerts ?? [])
  //   .map(({ alertId }) => alertId)
  //   .filter((alertId): alertId is string => typeof alertId === 'string');
  // const rect = useElementSize(headerStickyElRef);
  // const entityHeaderHeight = rect?.height ?? 0;
  // const tabs = useTabs(caseItem, alertIds, comments);
  // const { tab = tabs[0].key } = useParams<'list' | 'id' | 'tab'>();
  return (
    <AsyncResourceRenderer resource={caseQueryResults.data}>
      {(caseItem) => (
        <AlertDetailsTabs
          alert={alertItem}
          caseUserId={
            caseItem.caseUsers?.origin?.userId ?? caseItem.caseUsers?.destination?.userId ?? ''
          }
        />
      )}
    </AsyncResourceRenderer>
  );
  // return (
  //   <>
  //     <PageTabs
  //       sticky={entityHeaderHeight}
  //       activeKey={tab}
  //       onChange={(newTab) => {
  //         navigate(
  //           keepBackUrl(
  //             makeUrl('/case-management/case/:id/:tab', { id: caseItem.caseId, tab: newTab }),
  //           ),
  //           { replace: true },
  //         );
  //       }}
  //       eventData={{
  //         page: 'case-details',
  //       }}
  //       items={tabs.map((tab) => ({
  //         ...tab,
  //         children: (
  //           <div
  //             style={{
  //               minHeight: `calc(100vh - ${
  //                 entityHeaderHeight + TABS_LINE_HEIGHT + PAGE_WRAPPER_PADDING
  //               }px)`,
  //             }}
  //           >
  //             {tab.children}
  //           </div>
  //         ),
  //       }))}
  //     />
  //   </>
  // );
}

// function useAlertsComments(alertIds: string[]): AsyncResource<CommentGroup[]> {
//   const api = useApi();
//
//   const results = useQueries<ApiComment[]>({
//     queries: alertIds.map((alertId) => ({
//       queryKey: ALERT_ITEM_COMMENTS(alertId),
//       queryFn: async (): Promise<ApiComment[]> => {
//         const alert = await api.getAlert({
//           alertId: alertId,
//         });
//         return alert.comments ?? [];
//       },
//     })),
//   });
//
//   const commentsResources: AsyncResource<CommentGroup>[] = results.map(
//     (x: QueryResult<ApiComment[]>, i): AsyncResource<CommentGroup> => {
//       const alertId = alertIds[i];
//       return map(x.data, (comments: ApiComment[]) => ({
//         title: `Alert: ${alertId}`,
//         id: `alert-${alertId ?? ''}`,
//         comments,
//       }));
//     },
//   );
//
//   return all(commentsResources);
// }

// function useTabs(caseItem: Case, alertIds: string[], comments: CommentsHandlers): TabItem[] {
//   const { subjectType = 'USER' } = caseItem;
//   const api = useApi();
//   const isCrmEnabled = useFeatureEnabled('CRM');
//   const isEntityLinkingEnabled = useFeatureEnabled('ENTITY_LINKING');
//   const isUserSubject = subjectType === 'USER';
//   const isPaymentSubject = subjectType === 'PAYMENT';
//   const paymentDetails =
//     caseItem.paymentDetails?.origin ?? caseItem.paymentDetails?.destination ?? undefined;
//   const user = caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined;
//   const alertCommentsRes = useAlertsComments(alertIds);
//   const entityIds = getEntityIds(caseItem);
//   const [users, _] = useUsers();
//
//   const riskClassificationQuery = useRiskClassificationScores();
//   const riskClassificationValues = getOr(riskClassificationQuery, []);
//
//   const queryClient = useQueryClient();
//
//   const deleteCommentMutation = useMutation<
//     unknown,
//     unknown,
//     { commentId: string; groupId: string }
//   >(
//     async (variables) => {
//       if (caseItem.caseId == null) {
//         throw new Error(`Case is is null`);
//       }
//       const { commentId, groupId } = variables;
//       if (groupId.startsWith(ALERT_GROUP_PREFIX)) {
//         const parentId = groupId.replace(ALERT_GROUP_PREFIX, '');
//         await api.deleteAlertsComment({ alertId: parentId, commentId });
//       } else {
//         await api.deleteCasesCaseIdCommentsCommentId({ caseId: caseItem.caseId, commentId });
//       }
//     },
//     {
//       onSuccess: (data, variables) => {
//         message.success('Comment deleted!');
//         const { commentId, groupId } = variables;
//         if (groupId.startsWith(ALERT_GROUP_PREFIX)) {
//           const alertId = groupId.replace(ALERT_GROUP_PREFIX, '');
//           queryClient.setQueryData<Alert>(ALERT_ITEM(alertId), (alert) => {
//             if (!alert) {
//               return undefined;
//             }
//             return {
//               ...alert,
//               comments: (alert?.comments ?? []).filter((comment) => comment.id !== commentId),
//             };
//           });
//           queryClient.setQueryData<ApiComment[]>(ALERT_ITEM_COMMENTS(alertId), (comments) => {
//             if (comments == null) {
//               return comments;
//             }
//             return comments.filter((comment) => comment.id !== commentId);
//           });
//         } else if (caseItem.caseId) {
//           queryClient.setQueryData<Case>(
//             CASES_ITEM(caseItem.caseId),
//             (caseItem: Case | undefined) => {
//               if (caseItem == null) {
//                 return caseItem;
//               }
//               return {
//                 ...caseItem,
//                 comments: caseItem.comments?.filter((comment) => comment.id !== commentId),
//               };
//             },
//           );
//         }
//       },
//     },
//   );
//
//   return [
//     isPaymentSubject && {
//       title: 'Payment identifier details',
//       key: 'payment-details',
//       children: <PaymentIdentifierDetailsCard paymentDetails={paymentDetails} />,
//       isClosable: false,
//       isDisabled: false,
//     },
//     isUserSubject && {
//       title: 'User details',
//       key: 'user-details',
//       children: <UserDetails user={user} />,
//       isClosable: false,
//       isDisabled: false,
//     },
//     caseItem.caseType !== 'MANUAL' && {
//       title: 'Alerts',
//       key: 'alerts',
//       children: (
//         <AlertsCard
//           caseItem={caseItem}
//           // expandedAlertId={expandedAlertId}
//           title={UI_SETTINGS.cards.ALERTS.title}
//         />
//       ),
//       isClosable: false,
//       isDisabled: false,
//     },
//     caseItem.caseId &&
//       user &&
//       caseItem.caseType === 'MANUAL' && {
//         title: 'Case transactions',
//         key: 'case-transactions',
//         children: (
//           <CaseTransactionsCard
//             caseId={caseItem.caseId}
//             caseTransactionsCount={caseItem.caseTransactionsCount ?? 0}
//             caseType={caseItem.caseType}
//             user={user}
//           />
//         ),
//         isClosable: false,
//         isDisabled: false,
//       },
//     user &&
//       isCrmEnabled && {
//         title: (
//           <div className={style.icon}>
//             {' '}
//             <BrainIcon /> <span>&nbsp; CRM data</span>
//           </div>
//         ),
//         key: 'crm-monitoring',
//         children: user.userId ? <CRMMonitoring userId={user.userId} /> : undefined,
//         isClosable: false,
//         isDisabled: false,
//       },
//     isUserSubject &&
//       user &&
//       isEntityLinkingEnabled && {
//         title: <div className={style.icon}>Ontology</div>,
//         key: 'ontology',
//         children: user.userId ? <Linking userId={user.userId} /> : undefined,
//         isClosable: false,
//         isDisabled: false,
//         captureEvents: true,
//       },
//     isUserSubject &&
//       user?.userId && {
//         title: 'Transaction insights',
//         key: 'transaction-insights',
//         children: (
//           <InsightsCard userId={user.userId} title={UI_SETTINGS.cards.TRANSACTION_INSIGHTS.title} />
//         ),
//         isClosable: false,
//         captureEvents: true,
//         isDisabled: false,
//       },
//     isExistedUser(user) && {
//       title: 'Expected transaction limits',
//       key: 'expected-transaction-limits',
//       children: (
//         <Card.Root>
//           <ExpectedTransactionLimits user={user as InternalBusinessUser | InternalConsumerUser} />
//         </Card.Root>
//       ),
//       isClosable: false,
//       isDisabled: false,
//     },
//     {
//       title: 'Activity',
//       key: 'activity',
//       children: (
//         <AsyncResourceRenderer resource={alertCommentsRes}>
//           {(alertCommentsGroups) => (
//             <ActivityCard
//               logs={{
//                 request: async (params) => {
//                   const { alertId, filterCaseStatus, filterAlertStatus, filterActivityBy } = params;
//                   const response = await api.getAuditlog({
//                     sortField: 'timestamp',
//                     sortOrder: 'descend',
//                     searchEntityId: alertId ? [alertId] : entityIds,
//                     filterActions: ['CREATE', 'UPDATE', 'ESCALATE', 'DELETE'],
//                     filterActionTakenBy: filterActivityBy,
//                     alertStatus: flatten(filterAlertStatus),
//                     caseStatus: flatten(filterCaseStatus),
//                     includeRootUserRecords: true,
//                     pageSize: 100,
//                     entityIdExactMatch: true,
//                   });
//                   return getLogData(response.data, users, 'CASE', riskClassificationValues);
//                 },
//                 filters: ([params, setParams]) => (
//                   <>
//                     <StatusFilterButton
//                       initialState={params?.filterCaseStatus ?? []}
//                       onConfirm={(value) => {
//                         setParams((prevState) => ({
//                           ...prevState,
//                           filterCaseStatus: value,
//                         }));
//                       }}
//                       title={'Case status'}
//                     />
//                     <AlertIdSearchFilter
//                       initialState={params?.alertId}
//                       onConfirm={(value) => {
//                         setParams((prevState) => ({
//                           ...prevState,
//                           alertId: value,
//                         }));
//                       }}
//                     />
//                     <StatusFilterButton
//                       initialState={params?.filterAlertStatus ?? []}
//                       onConfirm={(value) => {
//                         setParams((prevState) => ({
//                           ...prevState,
//                           filterAlertStatus: value,
//                         }));
//                       }}
//                       title={'Alert status'}
//                     />
//                     <ActivityByFilterButton
//                       initialState={params?.filterActivityBy ?? []}
//                       onConfirm={(value) => {
//                         setParams((prevState) => ({
//                           ...prevState,
//                           filterActivityBy: value,
//                         }));
//                       }}
//                     />
//                   </>
//                 ),
//               }}
//               comments={{
//                 writePermissions: ['case-management:case-details:write'],
//                 handleAddComment: comments.handleAddComment,
//                 onCommentAdded: comments.onCommentAdded,
//                 deleteCommentMutation: deleteCommentMutation,
//                 dataRes: success(
//                   [
//                     ...alertCommentsGroups,
//                     {
//                       title: 'Case comments',
//                       id: caseItem.caseId ?? '-',
//                       comments: caseItem.comments ?? [],
//                     },
//                   ] ?? [],
//                 ),
//               }}
//             />
//           )}
//         </AsyncResourceRenderer>
//       ),
//       isClosable: false,
//       isDisabled: false,
//     },
//   ].filter(notEmpty);
// }
//
// export function getEntityIds(caseItem?: Case): string[] {
//   const ids = new Set<string | undefined>();
//   if (caseItem) {
//     ids.add(caseItem?.caseId);
//     caseItem?.alerts?.forEach((alert) => {
//       ids.add(alert.alertId);
//     });
//   }
//   return [...ids].filter(notEmpty);
// }
//
// const getLogData = (
//   logs: AuditLog[],
//   users: { [userId: string]: Account },
//   type: 'USER' | 'CASE',
//   riskClassificationValues: Array<RiskClassificationScore>,
// ): LogItemData[] => {
//   const logItemData: LogItemData[] = logs
//     .map((log) => {
//       let currentUser: Account | null = null;
//       if (log?.user?.id && users[log?.user?.id]) {
//         currentUser = users[log?.user?.id];
//       }
//       const getIcon = (type: string) => {
//         return type === 'CASE' ? (
//           <CaseIcon width={20} height={20} />
//         ) : (
//           <Avatar size="small" user={currentUser} />
//         );
//       };
//
//       const createStatement = getCreateStatement(log, users, type, riskClassificationValues);
//       if (isActionUpdate(log)) {
//         return createStatement
//           ? {
//               timestamp: log.timestamp,
//               user: log.user,
//               icon: getIcon('USER'),
//               statement: createStatement,
//             }
//           : null;
//       } else if (isActionCreate(log)) {
//         return createStatement
//           ? {
//               timestamp: log.timestamp,
//               user: log.user,
//               icon: getIcon(type),
//               statement: createStatement,
//             }
//           : null;
//       } else if (isActionEscalate(log)) {
//         return createStatement
//           ? {
//               timestamp: log.timestamp,
//               user: log.user,
//               icon: getIcon('CASE'),
//               statement: createStatement,
//             }
//           : null;
//       } else if (isActionDelete(log)) {
//         return createStatement
//           ? {
//               timestamp: log.timestamp,
//               user: log.user,
//               icon: getIcon(type),
//               statement: createStatement,
//             }
//           : null;
//       }
//       return null;
//     })
//     .filter((log) => log !== null) as LogItemData[];
//   return logItemData;
// };

export default AlertDetails;
