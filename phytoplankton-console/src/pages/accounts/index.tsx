import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { Tabs } from 'antd';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import Roles from './Roles';
import Team from './Team';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';

export default function () {
  const { section = 'team' } = useParams<'section'>() as {
    section: 'team' | 'roles';
  };
  const navigate = useNavigate();
  const i18n = useI18n();

  return (
    <PageWrapper title={i18n('menu.accounts')}>
      <PageTabs
        activeKey={section}
        onChange={(section) => {
          navigate(makeUrl(`/accounts/:section`, { section }), { replace: true });
        }}
      >
        <Tabs.TabPane tab={sentenceCase(i18n('menu.accounts.team'))} key={'team'}>
          <Team />
        </Tabs.TabPane>
        <Tabs.TabPane tab={sentenceCase(i18n('menu.accounts.roles'))} key={'roles'}>
          <Roles />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
}
