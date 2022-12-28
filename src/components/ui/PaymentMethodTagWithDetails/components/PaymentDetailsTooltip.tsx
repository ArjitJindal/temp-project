import s from './index.module.less';
import {
  humanizePropertyName,
  PaymentDetails,
} from '@/pages/transactions-item/UserDetails/PaymentDetails';
import { getPaymentMethodTitle } from '@/utils/payments';
import * as Form from '@/components/ui/Form';

interface Props {
  paymentDetails: PaymentDetails | undefined;
}

export const PaymentDetailsTooltip: React.FC<Props> = ({ paymentDetails }) => {
  if (!paymentDetails) {
    return <>-</>;
  }

  function Property(props: { name: string[]; value: unknown }) {
    const { name, value } = props;

    const humanizedName = name.map(humanizePropertyName).join(' / ');
    if (value != null) {
      if (Array.isArray(value)) {
        return (
          <div style={{ marginTop: '15px' }}>
            <Form.Layout.Label title={humanizedName}>{value.join(', ')}</Form.Layout.Label>
          </div>
        );
      } else if (typeof value === 'object') {
        return (
          <>
            {Object.entries(value).map(([entryKey, entryValue]) => (
              <Property key={entryKey} name={[...name, entryKey]} value={entryValue} />
            ))}
          </>
        );
      }
    }

    return (
      <>
        <Form.Layout.Label title={humanizedName}>{`${value}`}</Form.Layout.Label>
      </>
    );
  }
  return (
    <>
      <div className={s.paymentHeader}>{getPaymentMethodTitle(paymentDetails.method)} Details </div>
      <div className={s.details}>
        <div className={s.properties}>
          {Object.entries(paymentDetails).map(([key, value]) => (
            <>
              <Property key={key} name={[key]} value={value} />
            </>
          ))}
        </div>
      </div>
    </>
  );
};
