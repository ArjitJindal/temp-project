import { Tag } from 'antd';
import {
  SwapOutlined,
  ArrowsAltOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import style from './index.module.less';
import { TransactionType } from '@/apis/models/TransactionType';
import { neverReturn } from '@/utils/lang';

interface Props {
  transactionType: TransactionType | undefined;
}

export const TransactionTypeTag: React.FC<Props> = ({ transactionType }) => {
  if (!transactionType) {
    return <>-</>;
  }
  let transactionTypeDisplay: string;
  let transactionTypeIcon = <SwapOutlined />;
  let tagColor = 'geekblue';

  if (transactionType === 'DEPOSIT') {
    transactionTypeDisplay = 'Deposit';
    tagColor = 'green';
    transactionTypeIcon = <ArrowDownOutlined />;
  } else if (transactionType === 'EXTERNAL_PAYMENT') {
    transactionTypeDisplay = 'External Payment';
    tagColor = 'blue';
    transactionTypeIcon = <ArrowsAltOutlined />;
  } else if (transactionType === 'WITHDRAWAL') {
    transactionTypeDisplay = 'Withdrawal';
    tagColor = 'orange';
    transactionTypeIcon = <ArrowUpOutlined />;
  } else if (transactionType === 'REFUND') {
    transactionTypeDisplay = 'Withdrawal';
    tagColor = 'red';
    transactionTypeIcon = <UndoOutlined />;
  } else if (transactionType === 'TRANSFER') {
    transactionTypeDisplay = 'Transfer';
  } else {
    transactionTypeDisplay = neverReturn(transactionType, transactionType);
  }

  return (
    <span className={style.tag}>
      <Tag color={tagColor}>
        {transactionTypeIcon} {transactionTypeDisplay}
      </Tag>
    </span>
  );
};
