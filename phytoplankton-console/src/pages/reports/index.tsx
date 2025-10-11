import React from 'react';
import { useNavigate, useParams } from 'react-router';
import ReportsTable from './components/ReportsTable';
import { useI18n } from '@/locales';
import { useReportItem } from '@/hooks/api/reports';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import SarReportDrawer from '@/components/Sar/SarReportDrawer';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

const ReportsList = () => {
  const i18n = useI18n();

  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();

  const reportItemQueryResult = useReportItem(reportId ?? '');

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
