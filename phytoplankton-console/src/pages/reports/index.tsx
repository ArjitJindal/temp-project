import React from 'react';
import { useNavigate, useParams } from 'react-router';
import ReportsTable from './components/ReportsTable';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import { useI18n } from '@/locales';
import { useQuery } from '@/utils/queries/hooks';
import { Report } from '@/apis';
import { REPORTS_ITEM } from '@/utils/queries/keys';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import SarReportDrawer from '@/components/Sar/SarReportDrawer';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApi } from '@/api';

const ReportsList = () => {
  usePageViewTracker('Reports List Page');
  const i18n = useI18n();
  const api = useApi();
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

  return (
    <PageWrapper title={i18n('menu.reports.reports-list')}>
      <PageWrapperContentContainer>
        <ReportsTable />
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
