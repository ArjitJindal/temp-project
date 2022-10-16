import React from 'react';
import { Tabs } from 'antd';
import { useNavigate, useParams } from 'react-router';
import PageWrapper from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';
import CaseTableWrapper from '@/pages/case-management/CaseTableWrapper';

function TableList() {
  const i18n = useI18n();
  const navigate = useNavigate();
  const { list = 'transaction' } = useParams<'list' | 'id'>();

  // todo: i18n
  return (
    <PageWrapper title={i18n('menu.case-management')}>
      <PageTabs
        activeKey={list}
        onChange={(key) => {
          navigate(makeUrl('/case-management/:list', { list: key }));
        }}
      >
        <Tabs.TabPane tab="Transaction cases" key="transaction">
          <CaseTableWrapper caseType={'TRANSACTION'} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="User cases" key="user">
          <CaseTableWrapper caseType={'USER'} />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
}

export default TableList;
