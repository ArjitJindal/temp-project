import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { startCase } from 'lodash';
import Roles from './Roles';
import Team from './Team';
import { Authorized } from '@/components/utils/Authorized';
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
        items={[
          {
            key: 'team',
            title: startCase(i18n('menu.accounts.team')),
            children: (
              <Authorized required={['accounts:overview:read']} showForbiddenPage>
                <Team />
              </Authorized>
            ),
          },
          {
            key: 'roles',
            title: startCase(i18n('menu.accounts.roles')),
            children: (
              <Authorized required={['roles:overview:read']} showForbiddenPage>
                <Roles />
              </Authorized>
            ),
          },
        ]}
      />
    </PageWrapper>
  );
}
