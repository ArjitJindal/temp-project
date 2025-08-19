import { useState } from 'react';
export interface BaseModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export interface ModalHandlers<TModalProps> {
  handleModalEvent: (visibility: boolean) => void;
  updateModalState: (newState: TModalProps) => void;
}

interface Props<TModalProps, TChildrenProps extends ModalHandlers<TModalProps>> {
  children: (childrenProps: TChildrenProps) => React.ReactNode;
  ModalComponent: React.ComponentType<TModalProps>;
  modalInitialState?: TModalProps | undefined;
  childrenProps: Omit<TChildrenProps, keyof ModalHandlers<TModalProps>>;
}

export default function TableModalProvider<
  TModalProps extends BaseModalProps,
  TChildrenProps extends ModalHandlers<TModalProps>,
>(props: Props<TModalProps, TChildrenProps>) {
  const { children, ModalComponent, modalInitialState, childrenProps } = props;

  const [isModalVisible, setModalVisibility] = useState(false);
  const [modalState, setModalState] = useState<TModalProps | undefined>(modalInitialState);

  const handleModalEvent = (visibility: boolean) => {
    setModalVisibility(visibility);
  };

  const updateModalState = (newState: TModalProps) => {
    setModalState((prevState) => ({ ...prevState, ...newState }));
  };

  return (
    <>
      {children({
        ...childrenProps,
        handleModalEvent,
        updateModalState,
      } as TChildrenProps)}
      {modalState && (
        <ModalComponent
          {...(modalState as any)}
          isVisible={isModalVisible}
          onClose={() => setModalVisibility(false)}
        />
      )}
    </>
  );
}
