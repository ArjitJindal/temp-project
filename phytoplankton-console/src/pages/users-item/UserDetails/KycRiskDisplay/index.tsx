import React from 'react';
import GroupUserIcon from '@/components/ui/icons/group-user.react.svg';
import { useApi } from '@/api';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_ITEM_RISKS_KRS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useHasPermissions } from '@/utils/user-utils';

interface Props {
  userId: string;
}

export default function KycRiskDisplay({ userId }: Props) {
  const api = useApi();

  const queryResult = useQuery(USERS_ITEM_RISKS_KRS(userId), () => api.getKrsValue({ userId }));
  const isKycPermissionEnabled = useHasPermissions(['risk-scoring:risk-score-details:read']);

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
