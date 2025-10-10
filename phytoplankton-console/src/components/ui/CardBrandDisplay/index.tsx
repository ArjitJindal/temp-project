import { CreditCardOutlined } from '@ant-design/icons';
import style from './index.module.less';
import AmericanExpressIcon from '@/components/ui/icons/american_express.react.svg';
import VisaIcon from '@/components/ui/icons/visa.react.svg';
import JcbIcon from '@/components/ui/icons/jcb.react.svg';
import UnionPayIcon from '@/components/ui/icons/unionpay.react.svg';
import MasterCardIcon from '@/components/ui/icons/mastercard.react.svg';
import DiscoverIcon from '@/components/ui/icons/discover.react.svg';
import RuPayIcon from '@/components/ui/icons/rupay.react.svg';

interface Props {
  value?: string;
}

export const CardBrandDisplay: React.FC<Props> = ({ value }) => {
  if (value === null) {
    return <>-</>;
  }
  let paymentIcon = <CreditCardOutlined />;

  if (value === 'VISA') {
    paymentIcon = <VisaIcon />;
  } else if (value === 'JCB') {
    paymentIcon = <JcbIcon />;
  } else if (value === 'AMERICAN_EXPRESS') {
    paymentIcon = <AmericanExpressIcon />;
  } else if (value === 'UNIONPAY') {
    paymentIcon = <UnionPayIcon />;
  } else if (value === 'DISCOVER') {
    paymentIcon = <DiscoverIcon />;
  } else if (value === 'RUPAY') {
    paymentIcon = <RuPayIcon />;
  } else if (value === 'MASTERCARD') {
    paymentIcon = <MasterCardIcon />;
  }

  return <span className={style.icon}>{paymentIcon}</span>;
};
