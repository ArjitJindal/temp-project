import React from 'react';
import GroupUserIcon from '@/components/ui/icons/group-user.react.svg';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { useUserKrs } from '@/hooks/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useHasResources } from '@/utils/user-utils';

interface Props {
  userId: string;
}

export default function KycRiskDisplay({ userId }: Props) {
  const queryResult = useUserKrs(userId);
  const isKycPermissionEnabled = useHasResources(['read:::risk-scoring/risk-score-details/*']);

  return (
    <AsyncResourceRenderer resource={queryResult.data} renderLoading={() => <></>}>
      {(result) =>
        result && (
          <RiskScoreDisplay
            values={
              result?.krsScore != null
                ? [
                    {
                      score: result.krsScore,
                      createdAt: result.createdAt,
                      components: result.components,
                      factorScoreDetails: result.factorScoreDetails,
                      manualRiskLevel: result.manualRiskLevel,
                    },
                  ]
                : []
            }
            icon={<GroupUserIcon />}
            title="KYC risk score (KRS)"
            riskScoreName="KRS"
            showFormulaBackLink
            riskScoreAlgo={(values) => values.score}
            isExternalSource={Boolean(result?.manualRiskLevel)}
            isLocked={result.isLocked}
            hideInfo={!isKycPermissionEnabled}
          />
        )
      }
    </AsyncResourceRenderer>
  );
}
