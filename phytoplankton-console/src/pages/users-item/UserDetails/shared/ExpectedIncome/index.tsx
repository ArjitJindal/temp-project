import React from 'react';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import { ExpectedIncome as ApiExpectedIncome } from '@/apis';

interface Props {
  expectedIncome?: ApiExpectedIncome;
}

export default function ExpectedIncome(props: Props) {
  const { expectedIncome } = props;

  return (
    <EntityPropertiesCard
      title={'Expected income'}
      items={[
        {
          label: 'Daily expected income',
          value: expectedIncome?.dailyExpectedIncome
            ? `${expectedIncome?.dailyExpectedIncome?.amountValue?.toLocaleString()} ${
                expectedIncome?.dailyExpectedIncome?.amountCurrency
              }`
            : '-',
        },
        {
          label: 'Weekly expected income',
          value: expectedIncome?.weeklyExpectedIncome
            ? `${expectedIncome?.weeklyExpectedIncome?.amountValue?.toLocaleString()} ${
                expectedIncome?.weeklyExpectedIncome?.amountCurrency
              }`
            : '-',
        },
        {
          label: 'Monthly expected income',
          value: expectedIncome?.monthlyExpectedIncome
            ? `${expectedIncome?.monthlyExpectedIncome?.amountValue?.toLocaleString()} ${
                expectedIncome?.monthlyExpectedIncome?.amountCurrency
              }`
            : '-',
        },
        {
          label: 'Yearly expected income',
          value: expectedIncome?.yearlyExpectedIncome
            ? `${expectedIncome?.yearlyExpectedIncome?.amountValue?.toLocaleString()} ${
                expectedIncome?.yearlyExpectedIncome?.amountCurrency
              }`
            : '-',
        },
      ]}
    />
  );
}
