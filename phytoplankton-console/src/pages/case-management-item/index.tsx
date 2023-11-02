import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { usePrevious } from 'ahooks';
import Header from './components/Header';
import { Case, Comment } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import * as Card from '@/components/ui/Card';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { ALERT_LIST, CASES_ITEM } from '@/utils/queries/keys';
import CaseDetails from '@/pages/case-management-item/CaseDetails';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { isSuccess } from '@/utils/asyncResource';
import { useUpdateCaseQueryData } from '@/utils/api/cases';
import { Authorized } from '@/components/Authorized';

const CASE_REFETCH_INTERVAL_SECONDS = 60;

function CaseManagementItemPage() {
  const { id: caseId } = useParams<'id'>() as { id: string };
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const expandedAlertId = searchParams.get('expandedAlertId');
  const api = useApi();
  const queryClient = useQueryClient();
  useCloseSidebarByDefault();

  const updateCaseQueryData = useUpdateCaseQueryData();
  const queryResults = useQuery(
    CASES_ITEM(caseId),
    (): Promise<Case> =>
      api.getCase({
        caseId,
      }),
    {
      refetchInterval: CASE_REFETCH_INTERVAL_SECONDS * 1000,
    },
  );
  const previousQueryResults = usePrevious(queryResults);
  const caseData = useMemo(() => {
    if (isSuccess(queryResults.data)) {
      return queryResults.data;
    } else if (previousQueryResults != null && isSuccess(previousQueryResults.data)) {
      return previousQueryResults.data;
    }
    return queryResults.data;
  }, [previousQueryResults, queryResults.data]);

  const handleCommentAdded = (newComment: Comment) => {
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
        >
          <CaseDetails
            caseItem={caseItem}
            onReload={onReload}
            headerStickyElRef={headerStickyElRef}
            expandedAlertId={expandedAlertId ? expandedAlertId : ''}
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
