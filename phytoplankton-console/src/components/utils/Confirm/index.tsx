import React, { useCallback, useEffect, useState } from 'react';
import ConfirmModal from './ConfirmModal';
import { AsyncResource, init, useFinishedSuccessfully } from '@/utils/asyncResource';

export type Confirm = () => void;

interface ChildrenProps {
  onClick: Confirm;
}

export interface Props {
  title?: string;
  text: string | React.ReactNode;
  res?: AsyncResource;
  isDanger?: boolean;
  onConfirm: () => void;
  onSuccess?: () => void;
  children: (props: ChildrenProps) => React.ReactNode;
}

export default function Confirm(props: Props) {
  const { res, onConfirm, onSuccess, children, ...rest } = props;
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

  const handleCancel = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleChildrenClick = useCallback(() => {
    setIsVisible(true);
  }, []);

  return (
    <>
      <ConfirmModal
        {...rest}
        res={res}
        isVisible={isVisible}
        onConfirm={handleOk}
        onCancel={handleCancel}
      />
      {children({
        onClick: handleChildrenClick,
      })}
    </>
  );
}
