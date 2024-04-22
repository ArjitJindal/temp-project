import React, { useMemo } from 'react';
import { ValueItem } from '../RiskScoreDisplay/types';
import AiLogoIcon from './ai-logo.react.svg';
import { BUSINESS_DATA, CONSUMER_DATA, TRANSACTION_DATA, getRandomTimestamp } from './utils';
import { RiskLevel } from '@/utils/risk-levels';
import {
  InternalBusinessUser,
  InternalConsumerUser,
  InternalTransaction,
  RiskEntityType,
  RiskScoreComponent,
} from '@/apis';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { COLORS_V2_AI_RISK_DISPLAY_BACKGROUND } from '@/components/ui/colors';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface ExtendedValueItem extends ValueItem {
  drsScore: number;
  derivedRiskLevel?: RiskLevel;
}

type Props = {
  transaction?: InternalTransaction;
  businessUser?: InternalBusinessUser;
  consumerUser?: InternalConsumerUser;
};

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

const randomizedData = (rawData: {
  transaction?: InternalTransaction;
  businessUser?: InternalBusinessUser;
  consumerUser?: InternalConsumerUser;
}): ExtendedValueItem[] => {
  const data = rawData.transaction
    ? TRANSACTION_DATA(rawData.transaction)
    : rawData.businessUser
    ? BUSINESS_DATA(rawData.businessUser)
    : rawData.consumerUser
    ? CONSUMER_DATA(rawData.consumerUser)
    : [];

  return data.map((item): ExtendedValueItem => {
    const drsScore = Math.floor(Math.random() * 101); // Random value between 0 and 100
    const derivedRiskLevel = getRiskLevel(drsScore);
    const createdAt = getRandomTimestamp();
    const components: RiskScoreComponent[] = (item.components ?? []).map(
      (component): RiskScoreComponent => {
        const score = Math.floor((Math.random() * drsScore * 2) % 100); // Random value between 0 and 2 x drsScore
        const riskLevel = getRiskLevel(score);
        return {
          entityType: component.entityType as RiskEntityType,
          score,
          riskLevel,
          parameter: component.parameter as string,
          value: component.value,
          weight: component.weight ?? 1,
        };
      },
    );

    return { ...item, drsScore, score: drsScore, createdAt, derivedRiskLevel, components };
  });
};

const riskScoredata = (rawData: {
  transaction?: InternalTransaction;
  businessUser?: InternalBusinessUser;
  consumerUser?: InternalConsumerUser;
}): ExtendedValueItem[] => {
  return shuffleArray(randomizedData(rawData));
};

export default function AIRiskDisplay({ transaction, businessUser, consumerUser }: Props) {
  const isAiRiskScoreEnabled = useFeatureEnabled('AI_RISK_SCORE');
  const data = useMemo(
    () => riskScoredata({ transaction, businessUser, consumerUser }),
    [transaction, businessUser, consumerUser],
  );
  return isAiRiskScoreEnabled ? (
    <RiskScoreDisplay
      mainPanelCustomStyling={{
        background: COLORS_V2_AI_RISK_DISPLAY_BACKGROUND,
      }}
      values={data.map((x) => ({
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
