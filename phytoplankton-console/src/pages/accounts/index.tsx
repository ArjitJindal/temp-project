import { useNavigate, useParams } from 'react-router';
import { startCase } from 'lodash';
import s from './style.module.less';
import Roles from './Roles';
import RolesV2 from './RolesV2';
import { exportRolesDetails } from './Roles/utils';
import Team from './Team';
import { Authorized } from '@/components/utils/Authorized';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import { useRoles } from '@/utils/user-utils';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import { notEmpty } from '@/utils/array';

export default function () {
  const { section = 'team' } = useParams<{
    section: 'team' | 'roles';
  }>();
  const navigate = useNavigate();
  const i18n = useI18n();
  const isRBACV2Enabled = useFeatureEnabled('RBAC_V2');
  const [roles] = useRoles();

  const handleCreateRole = () => {
    navigate(makeUrl('/accounts/roles/new'), { replace: true });
  };

  const handleDownloadRoles = () => {
    exportRolesDetails(roles);
  };

  const handleTabChange = (section: string) => {
    navigate(makeUrl(`/accounts/:section`, { section }), { replace: true });
  };

  return (
    <PageWrapper
      title={isRBACV2Enabled ? undefined : i18n('menu.accounts')}
      header={
        isRBACV2Enabled ? (
          <div className={s.header}>
            <Breadcrumbs
              items={[
                {
                  title: 'Team management',
                  to: '/accounts',
                },
                section === 'team' && {
                  title: 'Accounts',
                  to: '/accounts/team',
                },
                section === 'roles' && {
                  title: 'Roles',
                  to: '/accounts/roles',
                },
              ].filter(notEmpty)}
            />
            {section === 'roles' && (
              <div className={s.actionButtons}>
                <Button type="TETRIARY" onClick={handleDownloadRoles}>
                  Download roles
                </Button>
                <Button onClick={handleCreateRole}>Create role</Button>
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      <PageTabs
        activeKey={section}
        onChange={(newSection) => {
          handleTabChange(newSection);
        }}
        items={[
          {
            key: 'team',
            title: startCase(isRBACV2Enabled ? 'Accounts' : i18n('menu.accounts.team')),
            children: (
              <Authorized
                required={['accounts:overview:read']}
                requiredResources={['read:::accounts/overview/*']}
                showForbiddenPage
              >
                <Team />
              </Authorized>
            ),
          },
          {
            key: 'roles',
            title: startCase(isRBACV2Enabled ? 'Roles' : i18n('menu.accounts.roles')),
            children: (
              <Authorized
                required={['roles:overview:read']}
                requiredResources={['read:::roles/overview/*']}
                showForbiddenPage
              >
                {isRBACV2Enabled ? <RolesV2 /> : <Roles />}
              </Authorized>
            ),
          },
        ]}
      />
    </PageWrapper>
  );
}
