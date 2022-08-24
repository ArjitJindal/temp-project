import s from './style.module.less';
import StatusList from '@/pages/transactions/components/TransactionStatusButton/PopupContent/StatueList';
import { RuleAction } from '@/apis';

interface Props {
  onConfirm: (status: RuleAction | undefined) => void;
}

export default function PopupContent(props: Props) {
  const { onConfirm } = props;

  function handleSelect(status: RuleAction | undefined) {
    onConfirm(status);
  }

  // todo: i18n
  return (
    <div className={s.root}>
      <div className={s.content}>
        <StatusList onSelectStatus={handleSelect} />
      </div>
    </div>
  );
}
