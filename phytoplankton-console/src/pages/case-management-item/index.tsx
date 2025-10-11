import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import Header from './components/Header';
import { Authorized } from '@/components/utils/Authorized';
import { Comment } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import { useNewUpdatesMessage } from '@/utils/queries/hooks';
import { ALERT_LIST, CASE_AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import CaseDetails from '@/pages/case-management-item/CaseDetails';
import { useCase } from '@/hooks/api/cases';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { FormValues } from '@/components/CommentEditor';
import { useUpdateAlertItemCommentsData, useUpdateAlertQueryData } from '@/utils/api/alerts';
import { ALERT_GROUP_PREFIX } from '@/utils/case-utils';
import { isSuccess } from '@/utils/asyncResource';
import { useUpdateCaseQueryData } from '@/utils/api/cases';

const CASE_REFETCH_INTERVAL_SECONDS = 60;

function CaseManagementItemPage() {
  const { id: caseId } = useParams<'id'>() as { id: string };
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const expandedAlertId = searchParams.get('expandedAlertId');
  const api = useApi();
  const queryClient = useQueryClient();
  useCloseSidebarByDefault();

  const updateAlertQueryData = useUpdateAlertQueryData();
  const updateCaseQueryData = useUpdateCaseQueryData();
  const updateAlertCommentsQueryData = useUpdateAlertItemCommentsData();
  const queryResults = useCase(caseId);

  const caseItemRes = queryResults.data;

  useNewUpdatesMessage(
    isSuccess(caseItemRes) ? caseItemRes.value.updatedAt : undefined,
    async () => (await api.getCase({ caseId })).updatedAt,
    () => `Case ${caseId} has new updates. Please refresh the page to see the updates.`,
    { refetchIntervalSeconds: CASE_REFETCH_INTERVAL_SECONDS },
  );

  const handleCommentAdded = async (newComment: Comment, groupId: string): Promise<void> => {
    await queryClient.invalidateQueries(CASE_AUDIT_LOGS_LIST(caseId, {}));

    if (groupId.startsWith(ALERT_GROUP_PREFIX)) {
      const alertId = groupId.replace(ALERT_GROUP_PREFIX, '');

      updateAlertQueryData(alertId, (alertItem) =>
        alertItem
          ? { ...alertItem, comments: [...(alertItem.comments ?? []), newComment] }
          : alertItem,
      );

      updateAlertCommentsQueryData(alertId, (comments) => [...(comments ?? []), newComment]);

      return;
    }

    updateCaseQueryData(caseId, (caseItem) =>
      caseItem == null
        ? caseItem
        : {
            ...caseItem,
            comments: [...(caseItem?.comments ?? []), newComment],
            updatedAt: Date.now(),
          },
    );
  };

  const handleAddCommentReply = async (commentFormValues: FormValues, groupId: string) => {
    if (caseId == null) {
      throw new Error(`Case ID is not defined`);
    }
    const commentData = {
      CommentRequest: { body: commentFormValues.comment, files: commentFormValues.files },
    };

    if (groupId.startsWith(ALERT_GROUP_PREFIX)) {
      const alertId = groupId.replace(ALERT_GROUP_PREFIX, '');

      return await api.createAlertsCommentReply({
        alertId,
        commentId: commentFormValues.parentCommentId ?? '',
        ...commentData,
      });
    }

    return await api.postCaseCommentsReply({
      caseId: caseId,
      commentId: commentFormValues.parentCommentId ?? '',
      ...commentData,
    });
  };

  const onReload = () => {
    queryResults.refetch();
    queryClient.invalidateQueries({ queryKey: ALERT_LIST() });
  };

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);

  return (
    <PageWrapper
      header={
        <Card.Root>
          <Header
            caseId={caseId}
            caseItemRes={caseItemRes}
            headerStickyElRef={setHeaderStickyElRef}
            onReload={onReload}
            onCommentAdded={handleCommentAdded}
          />
        </Card.Root>
      }
      disableHeaderPadding
    >
      <CaseDetails
        caseId={caseId}
        caseItemRes={caseItemRes}
        headerStickyElRef={headerStickyElRef}
        expandedAlertId={expandedAlertId ? expandedAlertId : ''}
        comments={{
          handleAddComment: handleAddCommentReply,
          onCommentAdded: handleCommentAdded,
        }}
      />
    </PageWrapper>
  );
}

export default function CaseManagementItemPageWrapper() {
  return (
    <Authorized minRequiredResources={['read:::case-management/case-details/*']}>
      <CaseManagementItemPage />
    </Authorized>
  );
}
