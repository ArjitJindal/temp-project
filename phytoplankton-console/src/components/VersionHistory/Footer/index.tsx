import { useState } from 'react';
import { UseMutationResult } from '@tanstack/react-query';
import s from './index.module.less';
import Alert from '@/components/library/Alert';
import Button from '@/components/library/Button';
import Modal from '@/components/library/Modal';
import Label from '@/components/library/Label';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import { message } from '@/components/library/Message';

interface Props<R> {
  isDisabled: boolean;
  mutation: UseMutationResult<R, Error, { comment: string }>;
  onCancel: () => void;
  footerMessage: string;
  versionId: string;
  modalTitle: string;
  modalIdLabel: string;
}

export default function VersionHistoryFooter<R>(props: Props<R>) {
  const { versionId, isDisabled, footerMessage, modalTitle, modalIdLabel, mutation, onCancel } =
    props;

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [versionHistoryData, setVersionHistoryData] = useState<{
    versionId: string;
    comment: string;
  }>({ versionId, comment: '' });

  const modal = (
    <Modal
      title={modalTitle}
      isOpen={isModalOpen}
      onCancel={() => setIsModalOpen(false)}
      onOk={async () => {
        if (!versionHistoryData.comment) {
          message.error('Comment is required');
          return;
        }

        await mutation.mutateAsync({ comment: versionHistoryData.comment });

        setIsModalOpen(false);
      }}
      okText="Save"
      width="M"
      okProps={{ isDisabled: mutation.isLoading }}
      cancelProps={{ isDisabled: mutation.isLoading }}
      maskClosable={!mutation.isLoading}
      cancelText="Cancel"
    >
      <div className={s.modalContent} data-cy="version-history-modal-content">
        <Label label={modalIdLabel} position="TOP" required={{ showHint: true, value: true }}>
          <TextInput value={versionId} isDisabled={true} testName="version-history-id-input" />
        </Label>
        <Label label="Comment" position="TOP" required={{ showHint: true, value: true }}>
          <TextArea
            value={versionHistoryData.comment}
            onChange={(comment) =>
              setVersionHistoryData({ ...versionHistoryData, comment: comment ?? '' })
            }
            placeholder="Enter comment"
          />
        </Label>
      </div>
    </Modal>
  );

  return (
    <>
      <div className={s.footerButtons}>
        <Alert type="TRANSPARENT">{footerMessage}</Alert>
        <div className={s.footerButtons}>
          <Button
            type="SECONDARY"
            onClick={() => setIsModalOpen(true)}
            isDisabled={isDisabled || isModalOpen}
            testName="version-history-save-button"
          >
            Save
          </Button>
          <Button
            type="TETRIARY"
            onClick={onCancel}
            isDisabled={isModalOpen}
            testName="version-history-cancel-button"
          >
            Cancel
          </Button>
        </div>
      </div>
      {modal}
    </>
  );
}
