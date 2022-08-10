import { Tag } from 'antd';
import {
  CreditCardOutlined,
  WalletOutlined,
  BankOutlined,
  MobileOutlined,
} from '@ant-design/icons';
import style from './TransactionDetails.module.less';

interface Props {
  paymentMethod: string | undefined;
}

export const PaymentMethodTag: React.FC<Props> = ({ paymentMethod }) => {
  if (!paymentMethod) {
    return <>-</>;
  }
  let paymentMethodDisplay: string;
  let paymentIcon = <BankOutlined />;
  let tagColor = 'green';

  if (paymentMethod === 'IBAN') {
    paymentMethodDisplay = 'IBAN Transfer';
  } else if (paymentMethod === 'ACH') {
    paymentMethodDisplay = 'ACH Transfer';
  } else if (paymentMethod === 'SWIFT') {
    paymentMethodDisplay = 'SWIFT Transfer';
  } else if (paymentMethod === 'GENERIC_BANK_ACCOUNT') {
    paymentMethodDisplay = 'Bank Transfer';
  } else if (paymentMethod === 'WALLET') {
    paymentMethodDisplay = 'Wallet';
    tagColor = 'purple';
    paymentIcon = <WalletOutlined />;
  } else if (paymentMethod === 'UPI') {
    paymentMethodDisplay = 'UPI';
    tagColor = 'magenta';
    paymentIcon = <MobileOutlined />;
  } else if (paymentMethod === 'CARD') {
    paymentMethodDisplay = 'Card';
    tagColor = 'volcano';
    paymentIcon = <CreditCardOutlined />;
  } else {
    paymentMethodDisplay = paymentMethod;
  }

  return (
    <span className={style.tag}>
      <Tag color={tagColor}>
        {paymentIcon} {paymentMethodDisplay}
      </Tag>
    </span>
  );
};
