import React from 'react';
import ReportsTable from './components/ReportsTable';
import { useI18n } from '@/locales';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';

const ReportsList = () => {
  const i18n = useI18n();

  return (
    <PageWrapper title={i18n('menu.reports.reports-list')}>
      <PageWrapperContentContainer>
        <ReportsTable />
      </PageWrapperContentContainer>
    </PageWrapper>
  );
};

export default ReportsList;
