import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { PaymentMethodTag } from '../PaymentTypeTag';
import style from './index.module.less';
import { PaymentDetailsTooltip } from './components/PaymentDetailsTooltip';
import { PaymentDetails } from '@/pages/transactions-item/UserDetails/PaymentDetails';

interface Props {
  paymentDetails: PaymentDetails | undefined;
}

export const PaymentMethodTagWithDetails: React.FC<Props> = ({ paymentDetails }) => {
  if (!paymentDetails) {
    return <>-</>;
  }
  const { method } = paymentDetails;

  return (
    <span className={style.tag}>
      <PaymentMethodTag paymentMethod={method} />
      <span style={{ marginTop: '1px' }}>
        <Tooltip
          title={<PaymentDetailsTooltip paymentDetails={paymentDetails} />}
          color="#fff"
          overlayStyle={{ minWidth: '331px' }}
        >
          <InfoCircleOutlined />
        </Tooltip>
      </span>
    </span>
  );
};
