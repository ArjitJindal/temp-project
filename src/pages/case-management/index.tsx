import React from 'react';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import CaseTableWrapper from '@/pages/case-management/CaseTableWrapper';
import { usePageViewTracker } from '@/utils/tracker';
import { useCloseSidebarByDefault } from '@/components/AppWrapper/Providers/SidebarProvider';

function TableList() {
  const i18n = useI18n();
  usePageViewTracker(`Case Management Page`);
  useCloseSidebarByDefault();

  return (
    <PageWrapper title={i18n('menu.case-management')}>
      <CaseTableWrapper />
    </PageWrapper>
  );
}

export default TableList;
