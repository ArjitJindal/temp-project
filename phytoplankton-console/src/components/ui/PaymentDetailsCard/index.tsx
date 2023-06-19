import s from './index.module.less';
import { Property } from './components/PaymentProperty';
import { PaymentDetails } from '@/pages/transactions-item/UserDetails/PaymentDetails';
import { getPaymentMethodTitle } from '@/utils/payments';

interface Props {
  paymentDetails: PaymentDetails | undefined;
}

export const PaymentDetailsCard: React.FC<Props> = ({ paymentDetails }) => {
  if (!paymentDetails) {
    return <>-</>;
  }

  return (
    <>
      <div className={s.details}>
        <div className={s.properties}>
          <>
            <Property
              key={'method'}
              name={['method']}
              value={getPaymentMethodTitle(paymentDetails.method)}
            />
          </>
          {Object.entries(paymentDetails).map(([key, value]) => {
            if (key !== 'method')
              return (
                <>
                  <Property key={key} name={[key]} value={value} />
                </>
              );
          })}
        </div>
      </div>
    </>
  );
};
