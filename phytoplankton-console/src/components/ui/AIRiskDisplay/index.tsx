import React from 'react';

//types
import { ValueItem } from '../RiskScoreDisplay/types';
import AiLogoIcon from './ai-logo.react.svg';
import { RiskLevel } from '@/utils/risk-levels';
import { RiskEntityType } from '@/apis';

//components
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { COLORS_V2_AI_RISK_DISPLAY_BACKGROUND } from '@/components/ui/colors';

export interface ExtendedValueItem extends ValueItem {
  drsScore: number;
  derivedRiskLevel?: RiskLevel;
}

const data = [
  {
    components: [
      {
        value: 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationPaymentDetails.method',
      },
      {
        value: 'DE',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.country',
      },
      {
        value: 'EUR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: 10,
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'createdTimestamp',
      },
      {
        value: 'IN',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.country',
      },
      {
        value: 'INR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.transactionCurrency',
      },
      {
        value: 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: 10,
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'createdTimestamp',
      },
      {
        value: 'EUR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    manualRiskLevel: 'MEDIUM' as RiskLevel,
    components: [
      {
        value: 10,
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'createdTimestamp',
      },
      {
        value: 'IN',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.country',
      },
      {
        value: 'INR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationAmountDetails.transactionCurrency',
      },
      {
        value: 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'destinationPaymentDetails.method',
      },
      {
        value: 'DE',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.country',
      },
      {
        value: 'EUR',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originAmountDetails.transactionCurrency',
      },
      {
        value: 'CARD',
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'originPaymentDetails.method',
      },
    ],
  },
  {
    components: [
      {
        value: 10,
        entityType: 'TRANSACTION' as RiskEntityType,
        parameter: 'createdTimestamp',
      },
      {
        value: 'IN',
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

const randomizedData = data.map((item): ExtendedValueItem => {
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

const aiText = 'The AI Risk score depends on these factors';

export default function AIRiskDisplay() {
  const data = shuffleArray(randomizedData);
  return (
    <RiskScoreDisplay
      mainPanelCustomStyling={{
        background: COLORS_V2_AI_RISK_DISPLAY_BACKGROUND,
      }}
      factorExplanationText={aiText}
      values={data.map((x) => ({
        score: x.drsScore,
        createdAt: x.createdAt,
        components: x.components,
      }))}
      icon={<AiLogoIcon />}
      title="AI risk score"
    />
  );
}
