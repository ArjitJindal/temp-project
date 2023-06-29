import React, { useCallback, useEffect, useState } from 'react';
import s from './style.module.less';
import Modal from '@/components/library/Modal';
import { AsyncResource, init, isLoading, useFinishedSuccessfully } from '@/utils/asyncResource';

export type Confirm = () => void;

interface ChildrenProps {
  onClick: Confirm;
}

interface Props {
  title?: string;
  text: string | React.ReactNode;
  res?: AsyncResource;
  isDanger?: boolean;
  onConfirm: () => void;
  onSuccess?: () => void;
  children: (props: ChildrenProps) => React.ReactNode;
}

export default function Confirm(props: Props) {
  const { isDanger, title, text, res, children, onConfirm, onSuccess } = props;
  const [isVisible, setIsVisible] = useState(false);
  const isSuccessfull = useFinishedSuccessfully(res ?? init());
  useEffect(() => {
    if (isSuccessfull) {
      setIsVisible(false);
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [isSuccessfull, onSuccess]);
  const handleOk = useCallback(() => {
    onConfirm();
    if (res == null) {
      setIsVisible(false);
    }
  }, [res, onConfirm]);

  const handleClick = useCallback(() => {
    setIsVisible(true);
  }, []);

  return (
    <>
      <Modal
        width="S"
        title={title ?? 'Confirm action'}
        isOpen={isVisible}
        onCancel={() => {
          setIsVisible(false);
        }}
        onOk={handleOk}
        okProps={{
          isLoading: res != null && isLoading(res),
          type: isDanger ? 'DANGER' : undefined,
        }}
        okText="Yes"
        cancelText="No"
      >
        <div className={s.text}>{text}</div>
      </Modal>
      {children({
        onClick: handleClick,
      })}
    </>
  );
}
