import React from 'react';
import { Tabs } from 'antd';
import { useNavigate } from 'react-router';
import CaseTable from './components/CaseTable';
import PageWrapper from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';

function TableList() {
  const i18n = useI18n();
  const navigate = useNavigate();

  // todo: i18n
  return (
    <PageWrapper title={i18n('menu.case-management')}>
      <PageTabs
        onChange={() => {
          navigate(makeUrl('/case-management'));
        }}
      >
        <Tabs.TabPane tab="Open" key="open">
          <CaseTable isOpenTab={true} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Closed" key="closed">
          <CaseTable isOpenTab={false} />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
}

export default TableList;
