import React from 'react';
import GroupUserIcon from '@/components/ui/icons/group-user.react.svg';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { useUserKrs } from '@/hooks/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useHasResources } from '@/utils/user-utils';
import { KrsScore } from '@/apis';

interface Props {
  userId: string;
}

export default function KycRiskDisplay({ userId }: Props) {
  const queryResult = useUserKrs(userId);
  const isKycPermissionEnabled = useHasResources(['read:::risk-scoring/risk-score-details/*']);

  return (
    <AsyncResourceRenderer resource={queryResult.data} renderLoading={() => <></>}>
      {(result) => {
        const krs = result as KrsScore | null;
        return (
          krs && (
            <RiskScoreDisplay
              values={
                krs?.krsScore != null
                  ? [
                      {
                        score: krs.krsScore,
                        createdAt: krs.createdAt,
                        components: krs.components,
                        factorScoreDetails: krs.factorScoreDetails,
                        manualRiskLevel: krs.manualRiskLevel,
                      },
                    ]
                  : []
              }
              icon={<GroupUserIcon />}
              title="KYC risk score (KRS)"
              riskScoreName="KRS"
              showFormulaBackLink
              riskScoreAlgo={(values) => values.score}
              isExternalSource={Boolean(krs?.manualRiskLevel)}
              isLocked={krs?.isLocked}
              hideInfo={!isKycPermissionEnabled}
            />
          )
        );
      }}
    </AsyncResourceRenderer>
  );
}
