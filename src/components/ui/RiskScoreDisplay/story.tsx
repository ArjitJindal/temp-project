import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { RISK_LEVELS } from '@/utils/risk-levels';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Risk levels'}>
        <PropertyMatrix x={[...RISK_LEVELS, undefined]}>
          {(riskLevel) => (
            <Component
              title="CRA risk score"
              icon={<User3LineIcon />}
              values={[32.99, 51.19, 10.28, 15.96, 40.95].map((value, x) => ({
                score: value,
                manualRiskLevel: riskLevel,
                createdAt: x,
                components: [
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 1,
                    entityType: 'TRANSACTION',
                    parameter: 'createdTimestamp',
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'IN',
                    entityType: 'TRANSACTION',
                    parameter: 'destinationAmountDetails.country',
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'INR',
                    entityType: 'TRANSACTION',
                    parameter: 'destinationAmountDetails.transactionCurrency',
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'CARD',
                    entityType: 'TRANSACTION',
                    parameter: 'destinationPaymentDetails.method',
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'DE',
                    entityType: 'TRANSACTION',
                    parameter: 'originAmountDetails.country',
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'EUR',
                    entityType: 'TRANSACTION',
                    parameter: 'originAmountDetails.transactionCurrency',
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'CARD',
                    entityType: 'TRANSACTION',
                    parameter: 'originPaymentDetails.method',
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'CARD',
                    entityType: 'TRANSACTION',
                    parameter: 'originPaymentDetails.method_2',
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'CARD',
                    entityType: 'TRANSACTION',
                    parameter: 'originPaymentDetails.method_3',
                  },
                ],
              }))}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Single value'}>
        <Component
          title="CRA risk score"
          icon={<User3LineIcon />}
          values={[
            {
              score: 32.99,
              createdAt: 0,
            },
          ]}
        />
      </UseCase>
      <UseCase title={'Empty'}>
        <Component title="CRA risk score" icon={<User3LineIcon />} values={[]} />
      </UseCase>
    </>
  );
}
