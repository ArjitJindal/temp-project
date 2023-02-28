import React, { useCallback, useEffect, useState } from 'react';
import s from './style.module.less';
import Modal from '@/components/ui/Modal';
import { AsyncResource, init, isLoading, useFinishedSuccessfully } from '@/utils/asyncResource';

export type Confirm = () => void;

interface ChildrenProps {
  onClick: Confirm;
}

interface Props {
  title: string;
  text: string;
  res?: AsyncResource;
  onConfirm: () => void;
  children: (props: ChildrenProps) => React.ReactNode;
}

export default function Confirm(props: Props) {
  const { title, text, res, children, onConfirm } = props;
  const [isVisible, setIsVisible] = useState(false);

  const isSuccess = useFinishedSuccessfully(res ?? init());
  useEffect(() => {
    if (isSuccess) {
      setIsVisible(false);
    }
  }, [isSuccess]);

  const handleOk = useCallback(() => {
    onConfirm();
    if (res == null) {
      setIsVisible(false);
    }
  }, [res, onConfirm]);

  return (
    <>
      <Modal
        title={title}
        isOpen={isVisible}
        onCancel={() => {
          setIsVisible(false);
        }}
        onOk={handleOk}
        okProps={{
          loading: res != null && isLoading(res),
        }}
        okText="Yes"
        cancelText="No"
      >
        <div className={s.text}>{text}</div>
      </Modal>
      {children({
        onClick: () => {
          setIsVisible(true);
        },
      })}
    </>
  );
}
