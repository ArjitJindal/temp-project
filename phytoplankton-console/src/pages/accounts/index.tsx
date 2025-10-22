import { useNavigate, useParams } from 'react-router';
import s from './style.module.less';
import RolesV2 from './RolesV2';
import { exportRolesDetails } from './Roles/utils';
import Team from './Team';
import { Authorized } from '@/components/utils/Authorized';
import PageWrapper from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';
import Button from '@/components/library/Button';
import { useRoles } from '@/utils/api/auth';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import { notEmpty } from '@/utils/array';

export default function () {
  const { section = 'team' } = useParams<{
    section: 'team' | 'roles';
  }>();
  const navigate = useNavigate();
  const { rolesList } = useRoles();

  const handleCreateRole = () => {
    navigate(makeUrl('/accounts/roles/new'), { replace: true });
  };

  const handleDownloadRoles = () => {
    exportRolesDetails(rolesList);
  };

  const handleTabChange = (section: string) => {
    navigate(makeUrl(`/accounts/:section`, { section }), { replace: true });
  };

  return (
    <PageWrapper
      header={
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
            title: 'Accounts',
            children: (
              <Authorized minRequiredResources={['read:::accounts/overview/*']}>
                <Team />
              </Authorized>
            ),
          },
          {
            key: 'roles',
            title: 'Roles',
            children: (
              <Authorized minRequiredResources={['read:::roles/overview/*']}>
                <RolesV2 />
              </Authorized>
            ),
          },
        ]}
      />
    </PageWrapper>
  );
}
