import { Tag } from 'antd';
import {
  BankOutlined,
  CreditCardOutlined,
  FileDoneOutlined,
  MobileOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import style from './index.module.less';
import { neverReturn } from '@/utils/lang';
import { getPaymentMethodTitle, PaymentMethod } from '@/utils/payments';

interface Props {
  paymentMethod: PaymentMethod | undefined;
}

export const PaymentMethodTag: React.FC<Props> = ({ paymentMethod }) => {
  if (!paymentMethod) {
    return <>-</>;
  }
  let paymentIcon = <BankOutlined />;
  let tagColor;

  if (paymentMethod === 'IBAN') {
    tagColor = 'green';
  } else if (paymentMethod === 'ACH') {
    tagColor = 'cyan';
  } else if (paymentMethod === 'SWIFT') {
    tagColor = 'gold';
  } else if (paymentMethod === 'GENERIC_BANK_ACCOUNT') {
    tagColor = 'pink';
  } else if (paymentMethod === 'WALLET') {
    tagColor = 'purple';
    paymentIcon = <WalletOutlined />;
  } else if (paymentMethod === 'UPI') {
    tagColor = 'magenta';
    paymentIcon = <MobileOutlined />;
  } else if (paymentMethod === 'CARD') {
    tagColor = 'volcano';
    paymentIcon = <CreditCardOutlined />;
  } else if (paymentMethod === 'MPESA') {
    tagColor = 'red';
    paymentIcon = <MobileOutlined />;
  } else if (paymentMethod === 'CHECK') {
    tagColor = 'orange';
    paymentIcon = <FileDoneOutlined />;
  } else {
    tagColor = neverReturn(paymentMethod, 'green');
  }
  return (
    <span className={style.tag}>
      <Tag color={tagColor}>
        {paymentIcon} {getPaymentMethodTitle(paymentMethod)}
      </Tag>
    </span>
  );
};
