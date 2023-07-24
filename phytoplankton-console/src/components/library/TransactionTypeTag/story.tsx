import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { TransactionType } from '@/apis';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Types'}>
        <PropertyMatrix<TransactionType>
          xLabel={'type'}
          x={['DEPOSIT', 'EXTERNAL_PAYMENT', 'WITHDRAWAL', 'REFUND', 'TRANSFER', 'OTHER']}
        >
          {(x) => <Component transactionType={x} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}
