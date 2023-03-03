import React, { useState } from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import { permissionsToRows } from './utils';
import s from './RoleForm.module.less';
import { AccountRole, Permission } from '@/apis';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import Form from '@/components/library/Form';
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

export interface FormValues {
  roleName: string;
  description: string;
}
export default function RoleForm({ role, onChange }: { role?: AccountRole; onChange: () => any }) {
  const api = useApi();
  const [edit, setEdit] = useState(!role);
  const [isLoading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set(role?.permissions || []));
  const rows = permissionsToRows(permissions);
  const fieldValidators: FieldValidators<FormValues> = {
    roleName: notEmpty,
    description: notEmpty,
  };
  const canEdit = !isValidManagedRoleName(role?.name);
  const isEditing = edit && canEdit;
  const allExpanded = expandedRows.length === rows.length;

  const onSubmit = async (
    { roleName, description }: { roleName: string; description: string },
    { isValid }: { isValid: boolean },
  ) => {
    if (!isValid) {
      return;
    }
    setLoading(true);
    try {
      const AccountRole = { name: roleName, description, permissions: [...permissions] };
      if (role?.id) {
        await api.updateRole({
          roleId: role?.id,
          AccountRole,
        });
      } else {
        await api.createRole({ AccountRole });
      }
      message.success(`${roleName} role saved`);
      onChange();
    } catch (e) {
      message.error(`Failed to save role - ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    setLoading(true);
    try {
      await api.deleteRole({ roleId: role?.id as string });
      message.success(`${role?.name} was deleted.`);
      onChange();
    } catch (e) {
      message.error(`Failed to delete role - ${getErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const onExpand = () =>
    allExpanded ? setExpandedRows([]) : setExpandedRows(rows.map((i) => i.name));
  const onPermissionChange = (permission: Permission, enabled: boolean) => {
    if (enabled) {
      permissions.add(permission);
      if (permission.endsWith(':write')) {
        const readPerm = permission.replace(/(.*:)write$/, '$1read');
        if (isValidPermission(readPerm)) {
          permissions.add(readPerm);
        }
      }
    } else {
      permissions.delete(permission);
      if (permission.endsWith(':read')) {
        const readPerm = permission.replace(/(.*:)read$/, '$1write');
        if (isValidPermission(readPerm)) {
          permissions.delete(readPerm);
        }
      }
    }
    setPermissions(new Set([...permissions]));
  };

  return (
    <Form<FormValues>
      id={role?.id}
      key={role?.id}
      onSubmit={onSubmit}
      initialValues={{ roleName: role?.name as string, description: role?.description as string }}
      fieldValidators={fieldValidators}
    >
      {!isEditing && (
        <>
          <h3>{sentenceCase(role?.name as string)}</h3>
          <h4>{sentenceCase(role?.description as string)}</h4>
        </>
      )}
      {isEditing && (
        <div className={s.input}>
          <InputField<FormValues> name={'roleName'} label={'Role name'}>
            {(inputProps) => <TextInput {...inputProps} placeholder={'Enter role name'} />}
          </InputField>
          <InputField<FormValues> name={'description'} label={'Role description'}>
            {(inputProps) => <TextInput {...inputProps} placeholder={'Enter a description'} />}
          </InputField>
        </div>
      )}
      <ButtonGroup>
        {canEdit && !isEditing && <Button onClick={() => setEdit(true)}>Edit</Button>}
        {isEditing && (
          <>
            <Button htmlType={'submit'} isLoading={isLoading}>
              Save
            </Button>
            {role?.id && (
              <Button type={'SECONDARY'} isLoading={isLoading} onClick={onDelete}>
                Delete
              </Button>
            )}
          </>
        )}
        <Button type={'SECONDARY'} onClick={onExpand}>
          {allExpanded ? 'Collapse all' : 'Show all'}
        </Button>
      </ButtonGroup>
      <PermissionTable
        key={role?.id}
        expandedRows={expandedRows}
        setExpandedRows={setExpandedRows}
        items={rows}
        onChange={isEditing ? onPermissionChange : undefined}
      />
    </Form>
  );
}
