import s from './style.module.less';
import StateList from './StateList';
import { TransactionState } from '@/apis';

interface Props {
  onConfirm: (status: TransactionState | undefined) => void;
}

export default function PopupContent(props: Props) {
  const { onConfirm } = props;

  function handleSelect(status: TransactionState | undefined) {
    onConfirm(status);
  }

  // todo: i18n
  return (
    <div className={s.root}>
      <div className={s.content}>
        <StateList onSelectState={handleSelect} />
      </div>
    </div>
  );
}
