import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { formatRoleName } from '../utils';
import s from '../style.module.less';
import Team from '../Team';
import RoleDetails from './RoleDetails';
import { AccountRole } from '@/apis';
import PageWrapper from '@/components/PageWrapper';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import Confirm from '@/components/utils/Confirm';
import { notEmpty } from '@/utils/array';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ROLE } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { isSuccess } from '@/utils/asyncResource';
import PageTabs from '@/components/ui/PageTabs';
import { Authorized } from '@/components/utils/Authorized';
import { makeUrl } from '@/utils/routing';
import { isValidManagedRoleName } from '@/apis/models-custom/ManagedRoleName';

interface LocationState {
  duplicate?: boolean;
  role?: AccountRole;
}

const AccountsRolesItemPage = () => {
  const { roleId, mode } = useParams<{ roleId: string; mode?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | undefined;
  const api = useApi();
  const [pendingNavigationTarget, setPendingNavigationTarget] = useState<string | null>(null);

  const roleQuery = useQuery(
    ROLE(roleId || 'new'),
    async () => {
      if (!!roleId && roleId !== 'new') {
        return await api.getRole({ roleId: roleId as string });
      }
      return undefined;
    },
    { enabled: roleId !== 'new' && !!roleId },
  );

  const handleSuccess = () => {
    navigate('/accounts/roles');
  };

  const handleCancelEdit = () => {
    if (roleId === 'new') {
      navigate('/accounts/roles');
    } else {
      navigate(`/accounts/roles/${roleId}/view`);
    }
  };

  const handleSetIsEditing = (editing: boolean) => {
    if (editing) {
      navigate(`/accounts/roles/${roleId}/edit`);
    } else {
      navigate(`/accounts/roles/${roleId}`);
    }
  };

  const getRoleName = () => {
    if (roleId === 'new') {
      return 'Create';
    }

    if (isSuccess(roleQuery.data) && roleQuery.data.value) {
      return formatRoleName(roleQuery.data.value.name);
    }

    return 'Loading...';
  };

  const renderNewRole = () => (
    <RoleDetails
      mode="edit"
      role={locationState?.duplicate ? locationState.role : undefined}
      onCancelEdit={handleCancelEdit}
      handleSuccess={handleSuccess}
      setIsEditing={handleSetIsEditing}
    />
  );

  const handleTabChange = (section: string) => {
    navigate(makeUrl(`/accounts/:section`, { section }), { replace: true });
  };

  const handleRoleTabClick = () => {
    navigate(makeUrl(`/accounts/roles/`), { replace: true });
  };

  const handleConfirmNavigation = () => {
    if (pendingNavigationTarget) {
      navigate(pendingNavigationTarget);
    } else {
      navigate('/accounts/roles');
    }
    setPendingNavigationTarget(null);
  };

  const handleBreadcrumbClick = (to: string) => {
    if (mode === 'edit' || roleId === 'new') {
      setPendingNavigationTarget(to);
      return true;
    } else {
      navigate(to);
      return false;
    }
  };

  return (
    <PageWrapper
      title="Accounts"
      header={
        <Confirm
          title="Discard changes?"
          text="Any unsaved changes will be lost. Do you want to continue?"
          isDanger
          onConfirm={handleConfirmNavigation}
        >
          {({ onClick }) => (
            <div className={s.header}>
              <Breadcrumbs
                items={[
                  {
                    title: 'Team management',
                    to: mode === 'edit' || roleId === 'new' ? undefined : '/accounts',
                    onClick: () => {
                      if (handleBreadcrumbClick('/accounts')) {
                        onClick();
                      }
                    },
                  },
                  {
                    title: 'Roles',
                    to: mode === 'edit' || roleId === 'new' ? undefined : '/accounts/roles',
                    onClick: () => {
                      if (handleBreadcrumbClick('/accounts/roles')) {
                        onClick();
                      }
                    },
                  },
                  { title: getRoleName() },
                ].filter(notEmpty)}
              />
            </div>
          )}
        </Confirm>
      }
    >
      <Confirm
        title="Discard changes?"
        text="Any unsaved changes will be lost. Do you want to continue?"
        isDanger
        onConfirm={handleConfirmNavigation}
      >
        {({ onClick }) => (
          <PageTabs
            activeKey="roles"
            onChange={(newSection) => {
              if (mode === 'edit' || roleId === 'new') {
                setPendingNavigationTarget(makeUrl(`/accounts/:section`, { section: newSection }));
                onClick();
              } else {
                handleTabChange(newSection);
              }
            }}
            items={[
              {
                key: 'team',
                title: 'Accounts',
                onClick: () => {
                  if (mode === 'edit' || roleId === 'new') {
                    setPendingNavigationTarget('/accounts/team');
                    onClick();
                  }
                },
                children: (
                  <Authorized
                    minRequiredResources={['read:::accounts/overview/*']}
                    showForbiddenPage
                  >
                    <Team />
                  </Authorized>
                ),
              },
              {
                key: 'roles',
                title: 'Roles',
                onClick: () => {
                  if (mode === 'edit' || roleId === 'new') {
                    setPendingNavigationTarget('/accounts/roles');
                    onClick();
                  } else {
                    handleRoleTabClick();
                  }
                },
                children: (
                  <Authorized minRequiredResources={['read:::roles/overview/*']} showForbiddenPage>
                    {roleId === 'new' ? (
                      renderNewRole()
                    ) : (
                      <AsyncResourceRenderer resource={roleQuery.data}>
                        {(roleData) => (
                          <RoleDetails
                            mode={
                              mode === 'edit' && !isValidManagedRoleName(roleData?.name)
                                ? 'edit'
                                : 'view'
                            }
                            role={roleData}
                            onCancelEdit={handleCancelEdit}
                            handleSuccess={handleSuccess}
                            setIsEditing={handleSetIsEditing}
                          />
                        )}
                      </AsyncResourceRenderer>
                    )}
                  </Authorized>
                ),
              },
            ]}
          />
        )}
      </Confirm>
    </PageWrapper>
  );
};

export default AccountsRolesItemPage;
