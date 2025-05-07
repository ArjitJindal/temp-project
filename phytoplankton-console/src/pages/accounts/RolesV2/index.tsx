import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRoleName } from '../utils';
import styles from './style.module.less';
import { AccountRole } from '@/apis';
import { STRING } from '@/components/library/Table/standardDataTypes';
import * as Card from '@/components/ui/Card';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import LockLineIcon from '@/components/ui/icons/Remix/system/lock-line.react.svg';
import { useRoles } from '@/utils/user-utils';
import { isValidManagedRoleName } from '@/apis/models-custom/ManagedRoleName';
import Id from '@/components/ui/Id';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import EyeLineIcon from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import { makeUrl } from '@/utils/routing';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { AsyncResource, success, loading } from '@/utils/asyncResource';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import Confirm from '@/components/utils/Confirm';
import { getErrorMessage } from '@/utils/lang';

const helper = new ColumnHelper<AccountRole>();

interface RolesTableData {
  items: AccountRole[];
  total: number;
}

export default function RolesV2() {
  const [roles, isLoading, refetchRoles] = useRoles();
  const navigate = useNavigate();
  const api = useApi();

  const tableData: AsyncResource<RolesTableData> = isLoading
    ? loading()
    : success({
        items: roles,
        total: roles.length,
      });

  const handleDelete = useCallback(
    async (item: AccountRole) => {
      try {
        await api.deleteRole({ roleId: item.id });
        message.success(`Role "${formatRoleName(item.name)}" has been deleted`);
        refetchRoles();
      } catch (error) {
        message.error(`Failed to delete role: ${getErrorMessage(error)}`);
      }
    },
    [api, refetchRoles],
  );

  const handleDuplicate = useCallback(
    (item: AccountRole) => {
      navigate('/accounts/roles/new', {
        state: {
          duplicate: true,
          role: {
            ...item,
            name: formatRoleName(item.name),
            description: `${item.description || item.name}`,
            id: undefined,
          },
        },
      });
    },
    [navigate],
  );

  const handleView = useCallback(
    (item: AccountRole) => {
      navigate(`/accounts/roles/${item.id}/view`);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (item: AccountRole) => {
      navigate(`/accounts/roles/${item.id}/edit`);
    },
    [navigate],
  );

  const columns = useMemo(
    () =>
      helper.list([
        helper.derived<string>({
          title: 'Role name',
          defaultWidth: 150,
          value: (entity) => {
            return entity.name;
          },
          type: {
            defaultWrapMode: 'WRAP',
            render: (value, { item }) => {
              return (
                <div className={styles.roleName}>
                  {isValidManagedRoleName(value) && <LockLineIcon className={styles.lockIcon} />}
                  <Id
                    to={makeUrl(`/accounts/roles/:roleId/:mode`, {
                      roleId: item.id,
                      mode: 'view',
                    })}
                  >
                    {formatRoleName(value)}
                  </Id>
                </div>
              );
            },
          },
        }),
        helper.simple<'description'>({
          title: 'Description',
          key: 'description',
          type: STRING,
          defaultWidth: 300,
        }),
        helper.display({
          title: 'Actions',
          defaultWidth: 200,
          render: (_, { item }) => {
            return (
              <div className={styles.actions} key={item.name}>
                <FileCopyLineIcon
                  className={styles.actionIcon}
                  onClick={() => handleDuplicate(item)}
                />
                <EyeLineIcon className={styles.actionIcon} onClick={() => handleView(item)} />
                {!isValidManagedRoleName(item.name) && (
                  <>
                    <EditLineIcon className={styles.actionIcon} onClick={() => handleEdit(item)} />
                    <Confirm
                      title="Delete Role"
                      text={`Are you sure you wish to remove the role "${formatRoleName(
                        item.name,
                      )}"?`}
                      isDanger
                      onConfirm={() => handleDelete(item)}
                    >
                      {({ onClick }) => (
                        <DeleteLineIcon className={styles.actionIcon} onClick={onClick} />
                      )}
                    </Confirm>
                  </>
                )}
              </div>
            );
          },
        }),
      ]),
    [handleEdit, handleView, handleDuplicate, handleDelete],
  );

  return (
    <Card.Root className={styles.tableCard}>
      <AsyncResourceRenderer resource={tableData}>
        {(data) => (
          <Table<AccountRole>
            rowKey="name"
            data={data}
            columns={columns}
            pagination={false}
            sizingMode="FULL_WIDTH"
            toolsOptions={false}
          />
        )}
      </AsyncResourceRenderer>
    </Card.Root>
  );
}
