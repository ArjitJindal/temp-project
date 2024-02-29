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
        <PropertyMatrix yLabel="riskLevel" y={[...RISK_LEVELS, undefined]}>
          {(_, riskLevel) => (
            <Component
              title="CRA risk score"
              icon={<User3LineIcon />}
              values={[32.99, 51.19, 10.28, 15.96, 40.95].map((value, x) => ({
                score: value,
                manualRiskLevel: riskLevel,
                createdAt: x,
                weight: 1,
                components: [
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 1,
                    entityType: 'TRANSACTION',
                    parameter: 'createdTimestamp',
                    weight: 1,
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'IN',
                    entityType: 'TRANSACTION',
                    parameter: 'destinationAmountDetails.country',
                    weight: 0.5,
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'INR',
                    entityType: 'TRANSACTION',
                    parameter: 'destinationAmountDetails.transactionCurrency',
                    weight: 0.5,
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'CARD',
                    entityType: 'TRANSACTION',
                    parameter: 'destinationPaymentDetails.method',
                    weight: 1,
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'DE',
                    entityType: 'TRANSACTION',
                    parameter: 'originAmountDetails.country',
                    weight: 1,
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'EUR',
                    entityType: 'TRANSACTION',
                    parameter: 'originAmountDetails.transactionCurrency',
                    weight: 1,
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'CARD',
                    entityType: 'TRANSACTION',
                    parameter: 'originPaymentDetails.method',
                    weight: 1,
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'CARD',
                    entityType: 'TRANSACTION',
                    parameter: 'originPaymentDetails.method_2',
                    weight: 1,
                  },
                  {
                    score: 90,
                    riskLevel: 'VERY_HIGH',
                    value: 'CARD',
                    entityType: 'TRANSACTION',
                    parameter: 'originPaymentDetails.method_3',
                    weight: 1,
                  },
                ],
              }))}
              riskScoreName="CRA risk score"
              riskScoreAlgo={(x) => x?.score}
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
          riskScoreName="CRA risk score"
          riskScoreAlgo={(x) => x?.score}
        />
      </UseCase>
      <UseCase title={'Empty'}>
        <Component
          title="CRA risk score"
          icon={<User3LineIcon />}
          values={[]}
          riskScoreName="CRA risk score"
          riskScoreAlgo={(x) => x?.score}
        />
      </UseCase>
    </>
  );
}
