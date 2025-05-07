import { humanizeConstant } from '@flagright/lib/utils/humanize';
import style from './index.module.less';
import ArrowUpLineIcon from '@/components/ui/icons/Remix/system/arrow-up-line.react.svg';
import ArrowRightLineIcon from '@/components/ui/icons/Remix/system/arrow-right-line.react.svg';
import ArrowDownLineIcon from '@/components/ui/icons/Remix/system/arrow-down-line.react.svg';
import ArrowGoBackLineIcon from '@/components/ui/icons/Remix/system/arrow-go-back-line.react.svg';
import ArrowLeftRightLineIcon from '@/components/ui/icons/Remix/system/arrow-left-right-line.react.svg';

interface Props {
  transactionType: string | undefined;
}

export default function TransactionTypeDisplay({ transactionType }: Props) {
  if (!transactionType) {
    return <>-</>;
  }

  let transactionTypeIcon: any = null;
  if (transactionType === 'DEPOSIT') {
    transactionTypeIcon = <ArrowDownLineIcon className={style.icon} />;
  } else if (transactionType === 'EXTERNAL_PAYMENT') {
    transactionTypeIcon = <ArrowRightLineIcon className={style.icon} />;
  } else if (transactionType === 'WITHDRAWAL') {
    transactionTypeIcon = <ArrowUpLineIcon className={style.icon} />;
  } else if (transactionType === 'REFUND') {
    transactionTypeIcon = <ArrowGoBackLineIcon className={style.icon} />;
  } else if (transactionType === 'TRANSFER') {
    transactionTypeIcon = <ArrowLeftRightLineIcon className={style.icon} />;
  } else {
    transactionTypeIcon = null;
  }

  return (
    <div className={style.root}>
      {transactionTypeIcon}
      <span>{humanizeConstant(transactionType)}</span>
    </div>
  );
}
