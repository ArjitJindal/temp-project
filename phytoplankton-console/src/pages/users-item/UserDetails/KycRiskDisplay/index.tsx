import React from 'react';
import GroupUserIcon from '@/components/ui/icons/group-user.react.svg';
import { useApi } from '@/api';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_ITEM_RISKS_KRS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

interface Props {
  userId: string;
}

export default function KycRiskDisplay({ userId }: Props) {
  const api = useApi();

  const queryResult = useQuery(USERS_ITEM_RISKS_KRS(userId), () => api.getKrsValue({ userId }));

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
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
                    },
                  ]
                : []
            }
            icon={<GroupUserIcon />}
            title="KYC risk score (KRS)"
            riskScoreName="KRS"
            showFormulaBackLink
            riskScoreAlgo={(values) => values.score}
          />
        )
      }
    </AsyncResourceRenderer>
  );
}
