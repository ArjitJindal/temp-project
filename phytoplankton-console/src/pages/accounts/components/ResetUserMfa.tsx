import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Account } from '@/apis';
import { FlagrightAuth0User, isAtLeast, UserRole } from '@/utils/user-utils';
import { useApi } from '@/api';
import Button from '@/components/library/Button';
import Modal from '@/components/library/Modal';
import { P } from '@/components/ui/Typography';
import { CloseMessage, message } from '@/components/library/Message';
import DeleteOutlined from '@/components/ui/icons/Remix/system/delete-bin-2-line.react.svg';

interface ResetMFAProps {
  item: Account;
  user: FlagrightAuth0User;
  onSuccess: () => void;
  isDisabled: (item: Account) => boolean;
}

export function ResetUserMfa(props: ResetMFAProps) {
  const { isDisabled, item, user, onSuccess } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);
  const api = useApi();

  let messageVar: CloseMessage | null = null;

  const resetUserMfa = useMutation<unknown, unknown, { userId: string }>(
    async (payload: { userId: string }) => {
      messageVar = message.loading(`Please wait while we are resetting user's MFA methods`);
      return await api.resetAccountMfa({
        accountId: payload.userId,
      });
    },
    {
      onSuccess: () => {
        messageVar?.();
        message.success(`User MFA methods resetted successfully`);
        setIsModalVisible(false);
        onSuccess();
      },
      onError: (error) => {
        messageVar?.();
        message.error(`Error while resetting the user's MFA methods: ${(error as Error)?.message}`);
      },
    },
  );

  const handleDelete = () => {
    if (isAtLeast(user, UserRole.ADMIN)) {
      setIsModalVisible(true);
    }
  };

  const confirmDelete = () => {
    resetUserMfa.mutate({
      userId: item.id,
    });
  };

  return (
    <>
      <Button
        testName="reset-mfa-button"
        type="TETRIARY"
        onClick={handleDelete}
        isDisabled={isDisabled(item)}
        icon={<DeleteOutlined />}
        requiredResources={['write:::accounts/overview/*']}
      >
        Reset MFA
      </Button>
      <Modal
        isOpen={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        title="Are you sure you want to reset all MFA methods configured by this user?"
        hideFooter
      >
        <div>
          <P grey variant="m" style={{ marginBottom: 16 }}>
            This action is equivalent to removing or deleting the user's MFA registration. The MFA
            settings associated with the user will be removed, which allows them to set up MFA as if
            they were a new user on their next login attempt.
          </P>
          <Button testName="delete-account" type="PRIMARY" onClick={confirmDelete}>
            Reset MFA
          </Button>
        </div>
      </Modal>
    </>
  );
}
