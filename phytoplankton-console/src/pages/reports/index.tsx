import React from 'react';
import { useNavigate, useParams } from 'react-router';
import ReportsTable from './components/ReportsTable';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { useApi } from '@/api';
import { useI18n } from '@/locales';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { Report } from '@/apis';
import { REPORTS_ITEM, REPORTS_LIST } from '@/utils/queries/keys';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import SarReportDrawer from '@/components/Sar/SarReportDrawer';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

const ReportsList = () => {
  usePageViewTracker('Reports List Page');
  const api = useApi();
  const i18n = useI18n();
  const measure = useApiTime();

  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();

  const reportItemQueryResult = useQuery<Report | null>(REPORTS_ITEM(reportId ?? ''), async () => {
    if (reportId == null) {
      return null;
    }
    return await measure(
      () =>
        api.getReportsReportId({
          reportId,
        }),
      'Reports Item',
    );
  });

  const queryResult = usePaginatedQuery<Report>(REPORTS_LIST(), async () => {
    return await measure(() => api.getReports({}), 'Reports List');
  });

  return (
    <PageWrapper title={i18n('menu.reports.reports-list')}>
      <PageWrapperContentContainer>
        <ReportsTable queryResult={queryResult} />
      </PageWrapperContentContainer>
      {reportId != null && (
        <AsyncResourceRenderer resource={reportItemQueryResult.data}>
          {(report) =>
            report ? (
              <SarReportDrawer
                initialReport={report}
                isVisible={!!report}
                onChangeVisibility={() => navigate('/reports', { replace: true })}
              />
            ) : (
              <></>
            )
          }
        </AsyncResourceRenderer>
      )}
    </PageWrapper>
  );
};

export default ReportsList;
