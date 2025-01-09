import React, { useState } from 'react';
import s from './styles.module.less';
import { ReasonType } from '@/apis';
import Button from '@/components/library/Button';
import Label from '@/components/library/Label';
import Modal from '@/components/library/Modal';
import TextInput from '@/components/library/TextInput';
import CloseCircleLineIcon from '@/components/ui/icons/Remix/system/close-fill.react.svg';
import { P } from '@/components/ui/Typography';
import Alert from '@/components/library/Alert';
interface Props {
  type: ReasonType | undefined;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (type: ReasonType, actionReasons: string[]) => void;
}

export default function ActionReasonModal(props: Props) {
  const { onClose, isOpen, type, onSubmit } = props;
  const [reasons, setReasons] = useState<string[]>([]);
  const [inputReason, setInputReason] = useState<string>();
  return (
    <Modal
      width="S"
      onCancel={() => {
        onClose();
        setInputReason('');
        setReasons([]);
      }}
      isOpen={isOpen}
      okText={'Done'}
      cancelText={'Cancel'}
      title={type === 'CLOSURE' ? 'Add case and alert closure reason' : 'Add escalation reason'}
      onOk={() => {
        if (!type) {
          return;
        }
        onSubmit(type, reasons);
        setInputReason('');
        setReasons([]);
      }}
    >
      <div className={s.root}>
        <Label label="Reason" />
        <div className={s.inputContainer}>
          <div className={s.textInput}>
            <TextInput
              value={inputReason}
              onChange={(val) => {
                setInputReason(val);
              }}
            />
          </div>
          <Button
            type="TEXT"
            size="SMALL"
            isDisabled={!inputReason}
            onClick={() => {
              if (inputReason) {
                setReasons((prev) => [...prev, inputReason]);
                setInputReason('');
              }
            }}
          >
            Add
          </Button>
        </div>
        {reasons && reasons.length > 0 && (
          <div className={s.reasonsContainer}>
            {reasons.map((reason, index) => (
              <div className={s.reason} key={index}>
                <P variant="m">{reason}</P>
                <Button
                  className={s.removeButton}
                  type="TEXT"
                  onClick={() => {
                    setReasons((prev) => prev.filter((val) => val !== reason));
                  }}
                  icon={<CloseCircleLineIcon />}
                />
              </div>
            ))}
          </div>
        )}
        <Alert type="info">
          Note that any updates will only apply to new, not closed and re-opened cases and alerts.
        </Alert>
      </div>
    </Modal>
  );
}
