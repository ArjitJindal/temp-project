import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Account, AccountDeletePayload } from '@/apis';
import { FlagrightAuth0User, UserRole } from '@/utils/user-utils';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import Modal from '@/components/library/Modal';
import Select from '@/components/library/Select';
import { P } from '@/components/ui/Typography';
import { CloseMessage, message } from '@/components/library/Message';
import DeleteOutlined from '@/components/ui/icons/Remix/system/delete-bin-2-line.react.svg';
import Confirm from '@/components/utils/Confirm';

interface DeleteUserProps {
  item: Account;
  user: FlagrightAuth0User;
  accounts: Account[];
  onSuccess: () => void;
  isDisabled: (item: Account) => boolean;
  setDeletedUserId: (id: string) => void;
}

export function DeleteUser(props: DeleteUserProps) {
  const { isDisabled, item, user, accounts, onSuccess, setDeletedUserId } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const api = useApi();

  let messageVar: CloseMessage | null = null;

  const deactiveUserMutation = useMutation<
    unknown,
    unknown,
    AccountDeletePayload & { userId: string }
  >(
    async (payload: AccountDeletePayload & { userId: string }) => {
      messageVar = message.loading(`Please wait while we are deleting the user`);
      return await api.accountsDelete({
        AccountDeletePayload: {
          reassignTo: payload.reassignTo,
        },
        accountId: payload.userId,
      });
    },
    {
      onSuccess: (_, { userId }) => {
        messageVar?.();
        message.success(`User deleted successfully`);
        setIsModalVisible(false);
        setReassignTo(null);
        onSuccess();
        setDeletedUserId(userId);
      },
      onError: (error) => {
        messageVar?.();
        message.error(`Error while deleting the user: ${(error as Error)?.message}`);
      },
    },
  );

  const handleDelete = () => {
    if (accounts.length === 1 && user.role === UserRole.ROOT) {
      deactiveUserMutation.mutate({
        userId: item.id,
        reassignTo: user.userId, // reassign to self if superuser is the only user
      });
    } else {
      const isReviewerIdAlreadyUsed = accounts.some((account) => account.reviewerId === item.id);

      if (isReviewerIdAlreadyUsed) {
        message.error(
          'This checker is already assigned to a maker, please check before deleting the checker',
        );

        return;
      }

      const isEscalationReviewerIdAlreadyUsed = accounts.some(
        (account) => account.escalationReviewerId === item.id && account.escalationLevel === 'L1',
      );

      if (isEscalationReviewerIdAlreadyUsed) {
        message.error('This escalation L2 is already assigned to a maker');
        return;
      }

      setIsModalVisible(true);
    }
  };

  const confirmDelete = () => {
    if (reassignTo) {
      deactiveUserMutation.mutate({
        userId: item.id,
        reassignTo,
      });
    }
  };

  if (accounts.length === 1 && user.role === UserRole.ROOT) {
    return (
      <Confirm
        text="This is the only user in the tenant."
        title="Are you sure you want to delete this user?"
        onConfirm={handleDelete}
      >
        {({ onClick }) => (
          <Button
            testName="accounts-delete-button"
            type="TETRIARY"
            onClick={onClick}
            isDisabled={isDisabled(item)}
            icon={<DeleteOutlined />}
          >
            Delete
          </Button>
        )}
      </Confirm>
    );
  }

  return (
    <>
      <Button
        testName="accounts-delete-button"
        type="TETRIARY"
        onClick={handleDelete}
        isDisabled={isDisabled(item)}
        icon={<DeleteOutlined />}
        requiredPermissions={['accounts:overview:write']}
      >
        Delete
      </Button>
      <Modal
        isOpen={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        title="Are you sure you want to delete this user?"
        hideFooter
      >
        <div>
          <P grey variant="m" style={{ marginBottom: 16 }}>
            Deleted users will no longer be able to log in to the console or perform any actions.
            <br />
            <b>
              Please select an account to reassign the open cases and alerts associated with the
              deleted user.
            </b>
          </P>
          <Select
            options={accounts
              .filter((account) => account.id !== item.id)
              .map((account) => ({
                label: account.email,
                value: account.id,
              }))}
            placeholder="Select an account Email ID"
            style={{ width: 300, marginBottom: 16 }}
            mode="SINGLE"
            onChange={(value) => setReassignTo(value ?? null)}
            value={reassignTo}
          />
          <Button
            testName="delete-account"
            type="PRIMARY"
            isDisabled={!reassignTo}
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  );
}
