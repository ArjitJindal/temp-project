import React from 'react';
import { InternalBusinessUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import TagList from '@/components/library/Tag/TagList';
import Money from '@/components/ui/Money';
import PaymentMethodTag from '@/components/library/Tag/PaymentTypeTag';
import { isPaymentMethod } from '@/utils/payments';

interface Props {
  user: InternalBusinessUser;
}

export default function TransactionAndPaymentMethodLimits(props: Props) {
  const { user } = props;

  const transactionLimits = user.transactionLimits;
  const paymentMethodLimits = transactionLimits?.paymentMethodLimits;

  return (
    <EntityPropertiesCard
      title={'Transaction and payment method limits'}
      items={[
        {
          label: 'Max. daily transaction limit',
          value: <Money amount={transactionLimits?.maximumDailyTransactionLimit} />,
        },
        {
          label: 'Max. weekly transaction limit',
          value: <Money amount={transactionLimits?.maximumWeeklyTransactionLimit} />,
        },
        {
          label: 'Max. monthly transaction limit',
          value: <Money amount={transactionLimits?.maximumMonthlyTransactionLimit} />,
        },
        {
          label: 'Max. quarterly transaction limit',
          value: <Money amount={transactionLimits?.maximumQuarterlyTransactionLimit} />,
        },
        {
          label: 'Max. transaction limit',
          value: <Money amount={transactionLimits?.maximumTransactionLimit} />,
        },
        {
          label: 'Max. yearly transaction limit',
          value: <Money amount={transactionLimits?.maximumYearlyTransactionLimit} />,
        },
        {
          label: 'Payment method limits',
          value: paymentMethodLimits ? (
            <TagList>
              {Object.keys(paymentMethodLimits)
                .filter(isPaymentMethod)
                .map((tag) => (
                  <PaymentMethodTag key={tag} paymentMethod={tag} />
                ))}
            </TagList>
          ) : undefined,
        },
      ]}
    />
  );
}
