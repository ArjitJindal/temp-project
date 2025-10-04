import { useState } from 'react';
import { useResetAccountMfa } from '@/hooks/api/users';
import { Account } from '@/apis';
import { FlagrightAuth0User } from '@/utils/user-utils';
import Button from '@/components/library/Button';
import Modal from '@/components/library/Modal';
import { P } from '@/components/ui/Typography';
import { CloseMessage, message } from '@/components/library/Message';
import DeleteOutlined from '@/components/ui/icons/Remix/system/delete-bin-2-line.react.svg';

interface ResetMFAProps {
  item: Account;
  user: FlagrightAuth0User;
  onSuccess: () => void;
}

export function ResetUserMfa(props: ResetMFAProps) {
  const { item, user, onSuccess } = props;
  const [isModalVisible, setIsModalVisible] = useState(false);

  let messageVar: CloseMessage | null = null;

  const resetUserMfa = useResetAccountMfa({
    onMutate: () => {
      messageVar = message.loading(`Please wait while we are resetting user's MFA methods`);
    },
    onSuccess: () => {
      messageVar?.();
      message.success(`User MFA methods resetted successfully`);
      setIsModalVisible(false);
      onSuccess();
    },
    onError: (error: any) => {
      messageVar?.();
      message.error(`Error while resetting the user's MFA methods: ${error?.message}`);
    },
  }) as any;

  const handleDelete = () => {
    setIsModalVisible(true);
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
        isDisabled={item.blocked || item.id === user.userId}
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
