import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import _ from 'lodash';
import { usePrevious } from 'ahooks';
import Header from './components/Header';
import { Case, Comment } from '@/apis';
import { useApi } from '@/api';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import * as Card from '@/components/ui/Card';
import { useQuery } from '@/utils/queries/hooks';
import { useBackUrl } from '@/utils/backUrl';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { ALERT_LIST, CASES_ITEM } from '@/utils/queries/keys';
import CaseDetails from '@/pages/case-management-item/CaseDetails';
import { ExpandableProvider } from '@/components/AppWrapper/Providers/ExpandableProvider';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';
import { isSuccess } from '@/utils/asyncResource';
import { useUpdateCaseQueryData } from '@/utils/api/cases';

const CASE_REFETCH_INTERVAL_SECONDS = 60;

function CaseManagementItemPage() {
  const { id: caseId } = useParams<'id'>() as { id: string };
  const api = useApi();
  const measure = useApiTime();
  const queryClient = useQueryClient();
  usePageViewTracker('Single Case Management Item Page');
  useCloseSidebarByDefault();

  const updateCaseQueryData = useUpdateCaseQueryData();
  const queryResults = useQuery(
    CASES_ITEM(caseId),
    (): Promise<Case> =>
      measure(
        () =>
          api.getCase({
            caseId,
          }),
        'Get Case Details',
      ),
    {
      refetchInterval: CASE_REFETCH_INTERVAL_SECONDS * 1000,
    },
  );
  const previousQueryResults = usePrevious(queryResults);
  const caseData = useMemo(() => {
    return isSuccess(queryResults.data) || !previousQueryResults
      ? queryResults.data
      : previousQueryResults.data;
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
        <>
          <Card.Root collapsable={false}>
            <Header
              headerStickyElRef={setHeaderStickyElRef}
              caseItem={caseItem}
              onReload={onReload}
              onCommentAdded={handleCommentAdded}
            />
          </Card.Root>
          <CaseDetails
            caseItem={caseItem}
            onReload={onReload}
            headerStickyElRef={headerStickyElRef}
          />
        </>
      )}
    </AsyncResourceRenderer>
  );
}

export default function CaseManagementItemPageWrapper() {
  const i18n = useI18n();
  const backUrl = useBackUrl();
  return (
    <PageWrapper
      backButton={{
        title: i18n('menu.case-management.item.back-button'),
        url: backUrl ?? makeUrl('/case-management'),
      }}
    >
      <ExpandableProvider>
        <CaseManagementItemPage />
      </ExpandableProvider>
    </PageWrapper>
  );
}
