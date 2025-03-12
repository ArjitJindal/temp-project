import React, { useCallback, useRef, useState } from 'react';
import { getDemoRoleName, getSantiziedRoleName, isDemoRole, formatRoleName } from '../utils';
import { permissionsToRows } from './utils';
import s from './RoleForm.module.less';
import FileCopyOutlined from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { AccountRole, CreateAccountRole, Permission } from '@/apis';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import Form, { FormRef } from '@/components/library/Form';
import PermissionTable from '@/pages/accounts/Roles/PermissionTable';
import { FieldValidators } from '@/components/library/Form/utils/validation/types';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import { isValidManagedRoleName } from '@/apis/models-custom/ManagedRoleName';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import ButtonGroup from '@/components/library/ButtonGroup';
import { isValidPermission } from '@/apis/models-custom/Permission';
import { TableRefType } from '@/components/library/Table/types';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';

export interface FormValues {
  roleName: string;
  description: string;
}

type RoleFormProps = {
  role?: AccountRole;
  onChange: (onDelete: boolean, onUpdate: boolean) => void;
  existingRoleNames: string[];
  type: 'create' | 'edit';
};

export default function RoleForm(props: RoleFormProps) {
  const { role, onChange, existingRoleNames, type } = props;
  const api = useApi();
  const [edit, setEdit] = useState(!role);
  const [duplicate, setDuplicate] = useState(false);
  const [roleName, setRoleName] = useState(getSantiziedRoleName(role?.name));
  const [isLoading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set(role?.permissions || []));
  const rows = permissionsToRows(permissions);
  const fieldValidators: FieldValidators<FormValues> = {
    roleName: notEmpty,
    description: notEmpty,
  };
  const canEdit = !isValidManagedRoleName(getSantiziedRoleName(role?.name));
  const isEditing = (duplicate || edit) && canEdit;
  const [allExpanded, setAllExpanded] = useState(false);
  const ref = useRef<FormRef<FormValues>>(null);
  const [isDemoModeRes] = useDemoMode();
  const isDemoMode = getOr(isDemoModeRes, false);

  const onSubmit = useCallback(
    async (
      { roleName, description }: { roleName: string; description: string },
      { isValid }: { isValid: boolean },
    ) => {
      if (!isValid) {
        return;
      }

      const demoRole = isDemoRole(role, isDemoMode);
      setLoading(true);
      try {
        if (isValidManagedRoleName(roleName)) {
          message.error('Role name should not match with default roles');
          return;
        }

        const existingRole = existingRoleNames.find(
          (name) => name.toLowerCase() === roleName.toLowerCase(),
        );

        if (type === 'create' && existingRole) {
          message.error(`Role name: ${roleName} already exists`);
          return;
        }

        if (roleName.includes(':')) {
          message.error('Character : is not allowed in role name');
          return;
        }

        if (roleName.includes('-')) {
          message.error('Character - is not allowed in role name');
          return;
        }

        if (demoRole) {
          roleName = getDemoRoleName(roleName);
        }

        const accountRole: CreateAccountRole = {
          name: roleName,
          description,
          permissions: [...permissions],
        };

        if (duplicate || !role?.id) {
          await api.createRole({ CreateAccountRole: accountRole });
        } else {
          await api.updateRole({ roleId: role?.id, AccountRole: { ...accountRole, id: role?.id } });
        }
        message.success(`${formatRoleName(roleName)} role saved`);
        onChange(false, true);
      } catch (e) {
        message.fatal(`Failed to save role - ${getErrorMessage(e)}`, e);
      } finally {
        setLoading(false);
      }
    },
    [role, isDemoMode, existingRoleNames, type, permissions, duplicate, onChange, api],
  );

  const onDelete = useCallback(async () => {
    setLoading(true);
    try {
      if (!role?.id) {
        message.fatal('Role ID is not set');
        return;
      }
      await api.deleteRole({ roleId: role?.id });
      message.success(`${getSantiziedRoleName(role?.name)} was deleted.`);
      onChange(true, false);
    } catch (e) {
      message.fatal(`Failed to delete role - ${getErrorMessage(e)}`, e);
    } finally {
      setLoading(false);
    }
  }, [role, api, onChange]);

  const tableRef = useRef<TableRefType | null>(null);

  const onExpand = useCallback(() => {
    tableRef.current?.toggleExpanded();
  }, []);

  const onPermissionChange = useCallback(
    (permission: Permission, enabled: boolean) => {
      if (enabled) {
        permissions.add(permission);
        if (permission.endsWith(':write')) {
          const readPerm = permission.replace(/(.*:)write$/, '$1read') as Permission;
          if (isValidPermission(readPerm)) {
            permissions.add(readPerm);
          }
        }
      } else {
        permissions.delete(permission);
        if (permission.endsWith(':read')) {
          const readPerm = permission.replace(/(.*:)read$/, '$1write') as Permission;
          if (isValidPermission(readPerm)) {
            permissions.delete(readPerm);
          }
        }
      }
      setPermissions(new Set([...permissions]));
    },
    [permissions],
  );

  return (
    <Form<FormValues>
      id={role?.id}
      key={role?.id}
      onSubmit={onSubmit}
      initialValues={{
        roleName: getSantiziedRoleName(role?.name) ?? '',
        description: role?.description ?? '',
      }}
      fieldValidators={fieldValidators}
      alwaysShowErrors={true}
      ref={ref}
    >
      {!isEditing && (
        <>
          <h3 className={s.title}>{formatRoleName(role?.name)}</h3>
          <h4>{role?.description}</h4>
        </>
      )}
      {isEditing && (
        <div className={s.input}>
          <InputField<FormValues>
            name={'roleName'}
            label={'Role name'}
            labelProps={{ required: { value: true, showHint: true } }}
          >
            {(inputProps) => (
              <TextInput
                {...inputProps}
                value={roleName}
                onChange={(value) => {
                  setRoleName(value ?? '');
                  inputProps.onChange?.(value);
                }}
                placeholder={'Enter role name'}
              />
            )}
          </InputField>
          <InputField<FormValues>
            name={'description'}
            label={'Role description'}
            labelProps={{ required: { value: true, showHint: true } }}
          >
            {(inputProps) => <TextInput {...inputProps} placeholder={'Enter a description'} />}
          </InputField>
        </div>
      )}
      <ButtonGroup>
        {canEdit && !isEditing && (
          <Button
            testName="edit-role"
            onClick={() => setEdit(true)}
            requiredPermissions={['roles:overview:write']}
          >
            Edit
          </Button>
        )}
        {canEdit && !isEditing && (
          <Button
            testName="duplicate-role"
            onClick={() => {
              setDuplicate(true);
              setRoleName(`${roleName} Copy`);
              ref.current?.setValues({
                ...ref.current?.getValues(),
                roleName: `${roleName} Copy`,
              });
            }}
            requiredPermissions={['roles:overview:write']}
            icon={<FileCopyOutlined />}
          >
            Duplicate
          </Button>
        )}
        {isEditing && (
          <>
            <Button htmlType={'submit'} isLoading={isLoading} testName="save-role">
              Save
            </Button>
            {role?.id && (
              <Button
                type={'SECONDARY'}
                isLoading={isLoading}
                onClick={onDelete}
                testName="delete-role"
              >
                Delete
              </Button>
            )}
          </>
        )}
        <Button type={'SECONDARY'} onClick={onExpand} testName="show-all">
          {allExpanded ? 'Collapse all' : 'Show all'}
        </Button>
      </ButtonGroup>
      <PermissionTable
        key={role?.id}
        tableRef={tableRef}
        items={rows}
        onChange={isEditing ? onPermissionChange : undefined}
        onExpandedChange={setAllExpanded}
      />
    </Form>
  );
}
