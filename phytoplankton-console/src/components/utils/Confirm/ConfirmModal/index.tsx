import React from 'react';
import s from './style.module.less';
import Modal from '@/components/library/Modal';
import { AsyncResource, isLoading } from '@/utils/asyncResource';

export type Confirm = () => void;

export interface Props {
  title?: string;
  text: string | React.ReactNode;
  res?: AsyncResource;
  isDanger?: boolean;
  isVisible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal(props: Props) {
  const { isVisible, isDanger, title, text, res, onConfirm, onCancel } = props;

  return (
    <Modal
      width="S"
      title={title ?? 'Confirm action'}
      isOpen={isVisible}
      onCancel={onCancel}
      onOk={onConfirm}
      okProps={{
        isLoading: res != null && isLoading(res),
        type: isDanger ? 'DANGER' : undefined,
      }}
      okText="Yes"
      cancelText="No"
    >
      <div className={s.text}>{text}</div>
    </Modal>
  );
}
