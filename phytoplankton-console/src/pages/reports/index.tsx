import React from 'react';
import ReportsTable from './components/ReportsTable';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { useApi } from '@/api';
import { useI18n } from '@/locales';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { Report } from '@/apis';
import { REPORTS_LIST } from '@/utils/queries/keys';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';

const ReportsList = () => {
  usePageViewTracker('Reports List Page');
  const api = useApi();
  const i18n = useI18n();
  const measure = useApiTime();

  const queryResult = usePaginatedQuery<Report>(REPORTS_LIST(), async () => {
    return await measure(() => api.getReports({}), 'Reports List');
  });

  return (
    <PageWrapper title={i18n('menu.reports.reports-list')}>
      <PageWrapperContentContainer>
        <ReportsTable queryResult={queryResult} />
      </PageWrapperContentContainer>
    </PageWrapper>
  );
};

export default ReportsList;
