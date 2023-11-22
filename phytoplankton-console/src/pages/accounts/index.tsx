import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import Roles from './Roles';
import Team from './Team';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';
import { Authorized } from '@/components/Authorized';

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
        items={[
          {
            key: 'team',
            title: sentenceCase(i18n('menu.accounts.team')),
            children: (
              <Authorized required={['settings:organisation:read']} showForbiddenPage>
                <Team />
              </Authorized>
            ),
          },
          {
            key: 'roles',
            title: sentenceCase(i18n('menu.accounts.roles')),
            children: (
              <Authorized required={['settings:organisation:read']} showForbiddenPage>
                <Roles />
              </Authorized>
            ),
          },
        ]}
      />
    </PageWrapper>
  );
}
