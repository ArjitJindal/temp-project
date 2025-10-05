import React from 'react';
import { useUserDrs } from '@/hooks/api';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useHasResources } from '@/utils/user-utils';
import DynamicRiskHistoryDisplay from '@/components/ui/DynamicRiskHistoryDisplay';

interface Props {
  userId: string;
}

export default function DynamicRiskDisplay({ userId }: Props) {
  const queryResult = useUserDrs(userId);
  const isDrsPermissionEnabled = useHasResources(['read:::risk-scoring/risk-score-details/*']);

  return (
    <AsyncResourceRenderer resource={queryResult.data} renderLoading={() => <></>}>
      {(result) => {
        if (!Array.isArray(result) || result.length === 0) {
          return null;
        }
        const value = {
          score: result[0].drsScore,
          manualRiskLevel: result[0]?.manualRiskLevel,
          createdAt: result[0].createdAt,
          components: result[0].components,
          factorScoreDetails: result[0].factorScoreDetails,
          transactionId: result[0].transactionId,
        };
        return (
          <DynamicRiskHistoryDisplay
            value={value}
            icon={<User3LineIcon />}
            title="CRA score"
            showFormulaBackLink
            riskScoreAlgo={(value) => value.score}
            hideInfo={!isDrsPermissionEnabled}
            userId={userId}
          />
        );
      }}
    </AsyncResourceRenderer>
  );
}
