import { Tag } from 'antd';
import {
  ArrowDownOutlined,
  ArrowsAltOutlined,
  ArrowUpOutlined,
  SwapOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import style from './index.module.less';
import { TransactionType } from '@/apis/models/TransactionType';
import { neverReturn } from '@/utils/lang';

export function getTransactionTypeColor(transactionType: TransactionType) {
  if (transactionType === 'DEPOSIT') {
    return 'green';
  } else if (transactionType === 'EXTERNAL_PAYMENT') {
    return 'blue';
  } else if (transactionType === 'WITHDRAWAL') {
    return 'orange';
  } else if (transactionType === 'REFUND') {
    return 'red';
  } else if (transactionType === 'TRANSFER') {
    return 'geekblue';
  } else if (transactionType === 'OTHER') {
    return 'geekblue';
  }

  return neverReturn(transactionType, 'white');
}

interface Props {
  transactionType: TransactionType | undefined;
}

export const TransactionTypeTag: React.FC<Props> = ({ transactionType }) => {
  if (!transactionType) {
    return <>-</>;
  }
  let transactionTypeDisplay: string;
  let transactionTypeIcon = <SwapOutlined />;

  if (transactionType === 'DEPOSIT') {
    transactionTypeDisplay = 'Deposit';
    transactionTypeIcon = <ArrowDownOutlined />;
  } else if (transactionType === 'EXTERNAL_PAYMENT') {
    transactionTypeDisplay = 'External Payment';
    transactionTypeIcon = <ArrowsAltOutlined />;
  } else if (transactionType === 'WITHDRAWAL') {
    transactionTypeDisplay = 'Withdrawal';
    transactionTypeIcon = <ArrowUpOutlined />;
  } else if (transactionType === 'REFUND') {
    transactionTypeDisplay = 'Refund';
    transactionTypeIcon = <UndoOutlined />;
  } else if (transactionType === 'TRANSFER') {
    transactionTypeDisplay = 'Transfer';
  } else if (transactionType === 'OTHER') {
    transactionTypeDisplay = 'Other';
  } else {
    transactionTypeDisplay = neverReturn(transactionType, '');
  }

  return (
    <span className={style.tag}>
      <Tag color={getTransactionTypeColor(transactionType)}>
        {transactionTypeIcon} {transactionTypeDisplay}
      </Tag>
    </span>
  );
};
