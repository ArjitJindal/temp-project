import React from 'react';
import { useNavigate } from 'react-router-dom';
import cn from 'clsx';
import { lowerCase } from 'lodash';
import { formatRoleName } from '../utils';
import s from './style.module.less';
import TextInput from '@/components/library/TextInput';
import * as Card from '@/components/ui/Card';
import TextArea from '@/components/library/TextArea';
import Label from '@/components/library/Label';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import DeleteLineIcon from '@/components/ui/icons/Remix/system/delete-bin-line.react.svg';
import { isValidManagedRoleName } from '@/apis/models-custom/ManagedRoleName';
import Confirm from '@/components/utils/Confirm';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useRoles } from '@/utils/user-utils';

interface RoleHeaderProps {
  mode: 'view' | 'edit';
  isLoading?: boolean;
  name: string;
  description: string;
  roleId?: string;
  onNameChange: (newName: string) => void;
  onDescriptionChange: (newDescription: string) => void;
  onEditClick: () => void;
}

const RoleHeader: React.FC<RoleHeaderProps> = ({
  mode,
  isLoading = false,
  name,
  description,
  roleId,
  onNameChange,
  onDescriptionChange,
  onEditClick,
}) => {
  const api = useApi();
  const navigate = useNavigate();
  const [, , refetchRoles] = useRoles();

  const handleDelete = async () => {
    if (!roleId) {
      message.error('Cannot delete role: missing role ID');
      return;
    }

    try {
      await api.deleteRole({ roleId });
      refetchRoles();
      message.success(`Role "${formatRoleName(name)}" has been deleted`);
      navigate('/accounts/roles');
    } catch (error) {
      message.error(`Failed to delete role: ${getErrorMessage(error)}`);
    }
  };

  if (mode === 'view') {
    return (
      <Card.Root className={cn(s.roleHeaderView, s.roleHeaderViewContent)}>
        <Card.Section direction="horizontal">
          <div>
            <h4 className={s.roleName}>{formatRoleName(name)}</h4>
            {!!description && <h6 className={s.roleDescription}>{description}</h6>}
          </div>
          {!isValidManagedRoleName(name) && (
            <div className={s.roleHeaderActions}>
              <EditLineIcon
                className={s.editIcon}
                onClick={onEditClick}
                data-cy={`edit-role-button-${lowerCase(name)}`}
              />
              <Confirm
                title="Delete Role"
                text={`Are you sure you wish to remove the role "${formatRoleName(name)}"?`}
                isDanger
                onConfirm={handleDelete}
              >
                {({ onClick }) => <DeleteLineIcon className={s.editIcon} onClick={onClick} />}
              </Confirm>
            </div>
          )}
        </Card.Section>
      </Card.Root>
    );
  }

  return (
    <Card.Root className={s.roleHeaderEdit}>
      <Card.Section direction="vertical">
        <Label label="Role name" required>
          <TextInput
            placeholder="Enter role name"
            value={name}
            onChange={(newValue) => onNameChange(newValue ?? '')}
            isDisabled={isLoading}
          />
        </Label>
        <Label label="Description">
          <TextArea
            placeholder="Enter role description"
            value={description}
            onChange={(newValue) => onDescriptionChange(newValue ?? '')}
            rows={2}
            isDisabled={isLoading}
          />
        </Label>
      </Card.Section>
    </Card.Root>
  );
};

export default RoleHeader;
