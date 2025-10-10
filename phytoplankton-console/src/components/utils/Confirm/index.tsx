import React, { useCallback, useEffect, useState } from 'react';
import { Resource } from '@flagright/lib/utils';
import ConfirmModal from './ConfirmModal';
import { AsyncResource, init, useFinishedSuccessfully } from '@/utils/asyncResource';

export type Confirm<Args> = (args?: Args) => void;

interface ChildrenProps<Args> {
  onClick: Confirm<Args>;
}

export interface Props<Args = unknown> {
  skipConfirm?: boolean;
  title?: string;
  text: string | React.ReactNode;
  res?: AsyncResource;
  isDanger?: boolean;
  commentRequired?: boolean;
  onConfirm: (formValues: { comment?: string; args: Args }) => void;
  onSuccess?: () => void;
  requiredResources?: Resource[];
  children: (props: ChildrenProps<Args>) => React.ReactNode;
}

export default function Confirm<Args = unknown>(props: Props<Args>) {
  const { res, onConfirm, onSuccess, children, skipConfirm, ...rest } = props;
  const [isVisible, setIsVisible] = useState(false);
  const isSuccessfull = useFinishedSuccessfully(res ?? init());
  const [args, setArgs] = useState<Args>();
  useEffect(() => {
    if (isSuccessfull) {
      setIsVisible(false);
      if (onSuccess) {
        onSuccess();
      }
    }
  }, [isSuccessfull, onSuccess]);

  const handleOk = useCallback(
    (formValues: { comment?: string }) => {
      onConfirm({
        ...formValues,
        args: args as Args,
      });
      if (res == null) {
        setIsVisible(false);
      }
    },
    [res, onConfirm, args],
  );

  const handleCancel = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleChildrenClick = useCallback(
    (args?: Args) => {
      if (skipConfirm) {
        onConfirm({
          args: args as Args,
        });
      } else {
        setArgs(args);
        setIsVisible(true);
      }
    },
    [onConfirm, skipConfirm],
  );

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
