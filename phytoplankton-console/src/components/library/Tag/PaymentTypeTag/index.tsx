import {
  BankOutlined,
  CreditCardOutlined,
  FileDoneOutlined,
  MobileOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import cn from 'clsx';
import Tag from '../index';
import style from './index.module.less';
import CashLine from '@/components/ui/icons/Remix/finance/copper-coin-line.react.svg';
import Shape2Line from '@/components/ui/icons/Remix/design/shape-2-line.react.svg';
import { neverReturn } from '@/utils/lang';
import { getPaymentMethodTitle, PaymentMethod } from '@/utils/payments';

interface Props {
  paymentMethod: PaymentMethod | undefined;
}

const PaymentMethodTag: React.FC<Props> = ({ paymentMethod }) => {
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
  } else if (paymentMethod === 'CASH') {
    tagColor = 'orange';
    paymentIcon = <CashLine />;
  } else if (paymentMethod === 'NPP') {
    tagColor = 'cyan';
    paymentIcon = <Shape2Line />;
  } else {
    tagColor = neverReturn(paymentMethod, 'green');
  }
  return (
    <span className={style.tag}>
      <Tag
        color={tagColor}
        icon={paymentIcon}
        className={cn(style.root, style[`paymentMethod-${paymentMethod}`])}
      >
        {getPaymentMethodTitle(paymentMethod)}
      </Tag>
    </span>
  );
};

export default PaymentMethodTag;
