import { useParams } from 'react-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Header from './components/Header';
import AlertDetails from './components/AlertDetails';
import { Authorized } from '@/components/utils/Authorized';
import PageWrapper from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { isLoading } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { Alert, Comment } from '@/apis';
import { useApi } from '@/api';
import { FormValues } from '@/components/CommentEditor';

function AlertItemPage() {
  const { id: alertId } = useParams<'id'>() as { id: string };
  // const location = useLocation();
  // const searchParams = new URLSearchParams(location.search);
  // const expandedAlertId = searchParams.get('expandedAlertId');
  const api = useApi();
  const queryClient = useQueryClient();
  // useCloseSidebarByDefault();
  //
  // const updateCaseQueryData = useUpdateCaseQueryData();
  // const updateAlertQueryData = useUpdateAlertQueryData();
  // const updateAlertCommentsQueryData = useUpdateAlertItemCommentsData();
  const alertQueryResults = useQuery(
    ALERT_ITEM(alertId),
    (): Promise<Alert> => api.getAlert({ alertId }),
  );

  //
  // useNewUpdatesMessage(
  //   isSuccess(queryResults.data) ? queryResults.data.value.updatedAt : undefined,
  //   async () => (await api.getCase({ caseId })).updatedAt,
  //   () => `Case ${caseId} has new updates. Please refresh the page to see the updates.`,
  //   { refetchIntervalSeconds: CASE_REFETCH_INTERVAL_SECONDS },
  // );
  //
  const handleCommentAdded = async (_newComment: Comment, _groupId: string) => {
    throw new Error(`Not implemented yet`);
    // await queryClient.invalidateQueries(CASE_AUDIT_LOGS_LIST(caseId, {}));
    //
    // if (groupId.startsWith(ALERT_GROUP_PREFIX)) {
    //   const alertId = groupId.replace(ALERT_GROUP_PREFIX, '');
    //
    //   updateAlertQueryData(alertId, (alertItem) => {
    //     if (alertItem == null) {
    //       return alertItem;
    //     }
    //     return {
    //       ...alertItem,
    //       comments: [...(alertItem?.comments ?? []), newComment],
    //     };
    //   });
    //
    //   updateAlertCommentsQueryData(alertId, (comments) => {
    //     if (comments == null) {
    //       return [newComment];
    //     }
    //     return [...comments, newComment];
    //   });
    //
    //   return;
    // }
    //
    // updateCaseQueryData(caseId, (caseItem) => {
    //   if (caseItem == null) {
    //     return caseItem;
    //   }
    //   return {
    //     ...caseItem,
    //     comments: [...(caseItem?.comments ?? []), newComment],
    //     updatedAt: Date.now(),
    //   };
    // });
  };
  //
  const handleAddCommentReply = async (_commentFormValues: FormValues, _groupId: string) => {
    throw new Error(`Not implemented yet`);
    // if (caseId == null) {
    //   throw new Error(`Case ID is not defined`);
    // }
    // const commentData = {
    //   CommentRequest: { body: commentFormValues.comment, files: commentFormValues.files },
    // };
    //
    // if (groupId.startsWith(ALERT_GROUP_PREFIX)) {
    //   const alertId = groupId.replace(ALERT_GROUP_PREFIX, '');
    //
    //   return await api.createAlertsCommentReply({
    //     alertId,
    //     commentId: commentFormValues.parentCommentId ?? '',
    //     ...commentData,
    //   });
    // }
    //
    // return await api.postCaseCommentsReply({
    //   caseId: caseId,
    //   commentId: commentFormValues.parentCommentId ?? '',
    //   ...commentData,
    // });
  };

  const onReload = () => {
    alertQueryResults.refetch();
    queryClient.invalidateQueries({ queryKey: ALERT_ITEM(alertId) });
  };

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);

  return (
    <AsyncResourceRenderer resource={alertQueryResults.data}>
      {(alertItem) => (
        <PageWrapper
          header={
            <Card.Root>
              <Header
                isLoading={isLoading(alertQueryResults.data)}
                headerStickyElRef={setHeaderStickyElRef}
                alertItem={alertItem}
                onReload={onReload}
                onCommentAdded={handleCommentAdded}
              />
            </Card.Root>
          }
          disableHeaderPadding
        >
          <AlertDetails
            alertItem={alertItem}
            headerStickyElRef={headerStickyElRef}
            comments={{
              handleAddComment: handleAddCommentReply,
              onCommentAdded: handleCommentAdded,
            }}
          />
        </PageWrapper>
      )}
    </AsyncResourceRenderer>
  );
}

export default function CaseManagementItemPageWrapper() {
  return (
    <Authorized required={['case-management:case-details:read']} showForbiddenPage>
      <AlertItemPage />
    </Authorized>
  );
}
