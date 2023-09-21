import React from 'react';

//types
import { ValueItem } from '../RiskScoreDisplay/types';
import AiLogoIcon from './ai-logo.react.svg';
import { RiskLevel } from '@/utils/risk-levels';
import { InternalTransaction, RiskEntityType } from '@/apis';

//components
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { COLORS_V2_AI_RISK_DISPLAY_BACKGROUND } from '@/components/ui/colors';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface ExtendedValueItem extends ValueItem {
  drsScore: number;
  derivedRiskLevel?: RiskLevel;
}

type Props = {
  transaction?: InternalTransaction;
};

const data = (transaction?: InternalTransaction) => [
  {
    components: [
      {
        value: transaction?.destinationPaymentDetails?.method ?? 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationPaymentDetails.method',
      },
      {
        value: transaction?.originAmountDetails?.country ?? 'IN',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.country',
      },
      {
        value: transaction?.originAmountDetails?.transactionCurrency ?? 'EUR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.originPaymentDetails?.method ?? 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: transaction?.timestamp ?? getRandomTimestamp(),
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'timestamp',
      },
      {
        value: transaction?.destinationAmountDetails?.country ?? 'DE',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.country',
      },
      {
        value: transaction?.destinationAmountDetails?.transactionCurrency ?? 'EUR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.originPaymentDetails?.method ?? 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: transaction?.timestamp ?? getRandomTimestamp(),
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'timestamp',
      },
      {
        value: transaction?.originAmountDetails?.transactionCurrency ?? 'USD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.originPaymentDetails?.method ?? 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    manualRiskLevel: 'MEDIUM' as RiskLevel,
    components: [
      {
        value: transaction?.timestamp ?? getRandomTimestamp(),
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'timestamp',
      },
      {
        value: transaction?.destinationAmountDetails?.country ?? 'DE',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.country',
      },
      {
        value: transaction?.destinationAmountDetails?.transactionCurrency ?? 'EUR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.destinationPaymentDetails?.method ?? 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationPaymentDetails.method',
      },
      {
        value: transaction?.originAmountDetails?.country ?? 'IN',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.country',
      },
      {
        value: transaction?.originAmountDetails?.transactionCurrency ?? 'EUR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: transaction?.originPaymentDetails?.method ?? 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: transaction?.timestamp ?? getRandomTimestamp(),
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'timestamp',
      },
      {
        value: transaction?.destinationAmountDetails?.country ?? 'DE',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.country',
      },
    ],
  },
];

const getRiskLevel = (score: number): RiskLevel => {
  let riskLevel;
  switch (true) {
    case score < 20:
      riskLevel = 'VERY_LOW';
      break;
    case score < 40:
      riskLevel = 'LOW';
      break;
    case score < 60:
      riskLevel = 'MEDIUM';
      break;
    case score < 80:
      riskLevel = 'HIGH';
      break;
    default:
      riskLevel = 'VERY_HIGH';
  }
  return riskLevel as RiskLevel;
};

function getRandomTimestamp() {
  const timeStamps = [1680020420000, 1680020421000, 1680020421000, 1680010421000];
  const randomIndex = Math.floor(Math.random() * timeStamps.length);
  return timeStamps[randomIndex];
}

function shuffleArray(array: ExtendedValueItem[]): ExtendedValueItem[] {
  // Iterate over the array from the end to the beginning
  for (let i = array.length - 1; i > 0; i--) {
    // Generate a random index between 0 and i
    const j = Math.floor(Math.random() * (i + 1));

    // Swap elements array[i] and array[j]
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

const randomizedData = (transaction?: InternalTransaction) =>
  data(transaction).map((item): ExtendedValueItem => {
    const drsScore = Math.floor(Math.random() * 101); // Random value between 0 and 100
    const derivedRiskLevel = getRiskLevel(drsScore);
    const createdAt = getRandomTimestamp() as number;
    const components = item.components?.map((component) => {
      const score = Math.floor((Math.random() * drsScore * 2) % 100) as number; // Random value between 0 and 2 x drsScore
      const riskLevel = getRiskLevel(score);
      return { ...component, score, riskLevel };
    });

    return { ...item, drsScore, score: drsScore, createdAt, derivedRiskLevel, components };
  });

const riskScoredata = (transaction?: InternalTransaction) =>
  shuffleArray(randomizedData(transaction));

export default function AIRiskDisplay({ transaction }: Props) {
  const isAiRiskScoreEnabled = useFeatureEnabled('AI_RISK_SCORE');
  return isAiRiskScoreEnabled ? (
    <RiskScoreDisplay
      mainPanelCustomStyling={{
        background: COLORS_V2_AI_RISK_DISPLAY_BACKGROUND,
      }}
      values={riskScoredata(transaction).map((x) => ({
        score: x.drsScore,
        createdAt: x.createdAt,
        components: x.components,
      }))}
      icon={<AiLogoIcon />}
      title="AI risk score"
      riskScoreName="AI risk score"
      riskScoreAlgo={(values) => {
        const score =
          (values.components ?? []).reduce((acc, curr) => acc + curr.score, 0) /
          (values?.components?.length ?? 1);

        return score;
      }}
    />
  ) : (
    <></>
  );
}
