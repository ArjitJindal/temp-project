import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { usePrevious } from 'ahooks';
import Header from './components/Header';
import { Authorized } from '@/components/utils/Authorized';
import { Case, Comment } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { ALERT_LIST, CASES_ITEM, CASE_AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import CaseDetails from '@/pages/case-management-item/CaseDetails';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { isSuccess } from '@/utils/asyncResource';
import { useUpdateCaseQueryData } from '@/utils/api/cases';
import { FormValues } from '@/components/CommentEditor';

function CaseManagementItemPage() {
  const { id: caseId } = useParams<'id'>() as { id: string };
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const expandedAlertId = searchParams.get('expandedAlertId');
  const api = useApi();
  const queryClient = useQueryClient();
  useCloseSidebarByDefault();

  const updateCaseQueryData = useUpdateCaseQueryData();
  // TODO: Add Refetch of 60 Seconds again FR-4782
  const queryResults = useQuery(CASES_ITEM(caseId), (): Promise<Case> => api.getCase({ caseId }));
  const previousQueryResults = usePrevious(queryResults);
  const caseData = useMemo(() => {
    if (isSuccess(queryResults.data)) {
      return queryResults.data;
    } else if (previousQueryResults != null && isSuccess(previousQueryResults.data)) {
      return previousQueryResults.data;
    }
    return queryResults.data;
  }, [previousQueryResults, queryResults.data]);

  const handleCommentAdded = async (newComment: Comment) => {
    await queryClient.invalidateQueries(CASE_AUDIT_LOGS_LIST(caseId, {}));
    updateCaseQueryData(caseId, (caseItem) => {
      if (caseItem == null) {
        return caseItem;
      }
      return {
        ...caseItem,
        comments: [...(caseItem?.comments ?? []), newComment],
      };
    });
  };

  const handleAddCommentReply = async (commentFormValues: FormValues) => {
    if (caseId == null) {
      throw new Error(`Case ID is not defined`);
    }
    const commentData = {
      Comment: { body: commentFormValues.comment, files: commentFormValues.files },
    };
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
    <AsyncResourceRenderer resource={caseData}>
      {(caseItem) => (
        <PageWrapper
          header={
            <Card.Root>
              <Header
                headerStickyElRef={setHeaderStickyElRef}
                caseItem={caseItem}
                onReload={onReload}
                onCommentAdded={handleCommentAdded}
              />
            </Card.Root>
          }
          disableHeaderPadding
        >
          <CaseDetails
            caseItem={caseItem}
            headerStickyElRef={headerStickyElRef}
            expandedAlertId={expandedAlertId ? expandedAlertId : ''}
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
      <CaseManagementItemPage />
    </Authorized>
  );
}
