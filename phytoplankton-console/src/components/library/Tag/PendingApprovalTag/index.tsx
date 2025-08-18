import { ReactNode, useMemo, useState } from 'react';
import cn from 'clsx';
import Tag from '../index';
import style from './index.module.less';
import HistoryLine from '@/components/ui/icons/Remix/system/history-line.react.svg';

interface ModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface Props {
  renderModal?: (props: ModalProps) => ReactNode;
}

export default function PendingApprovalTag(props: Props) {
  const { renderModal } = props;
  const [isModalOpen, setModalOpen] = useState(false);
  const handleClick = useMemo(() => {
    if (!renderModal) {
      return undefined;
    }
    return () => setModalOpen(true);
  }, [renderModal]);
  return (
    <>
      <Tag
        className={cn(style.root, handleClick != null && style.isClickable)}
        color="action"
        icon={<HistoryLine className={style.icon} />}
        onClick={handleClick}
      >
        <span>Pending approval</span>
      </Tag>
      {renderModal?.({ isOpen: isModalOpen, setIsOpen: setModalOpen })}
    </>
  );
}
