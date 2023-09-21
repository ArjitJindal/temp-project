import React from 'react';
import Icon from './icon.react.svg';
import { useApi } from '@/api';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_ITEM_RISKS_KRS } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

interface Props {
  userId: string;
}

export default function KycRiskDisplay({ userId }: Props) {
  const api = useApi();

  const queryResult = useQuery(USERS_ITEM_RISKS_KRS(userId), () => api.getKrsValue({ userId }));

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(result) => (
        <RiskScoreDisplay
          values={
            result?.krsScore
              ? [
                  {
                    score: result.krsScore,
                    createdAt: result.createdAt,
                    components: result.components,
                  },
                ]
              : []
          }
          icon={<Icon />}
          title="KYC risk score (KRS)"
          riskScoreName="KRS"
          showFormulaBackLink
          riskScoreAlgo={(values) => values.score}
        />
      )}
    </AsyncResourceRenderer>
  );
}
