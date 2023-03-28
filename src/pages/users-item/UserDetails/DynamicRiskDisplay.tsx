import React from 'react';
import { useApi } from '@/api';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import { USERS_ITEM_RISKS_DRS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

interface Props {
  userId: string;
}

export default function DynamicRiskDisplay({ userId }: Props) {
  const api = useApi();

  const queryResult = useQuery(USERS_ITEM_RISKS_DRS(userId), () => api.getDrsValue({ userId }));

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(result) => (
        <RiskScoreDisplay
          values={result.map((x) => ({
            value: x.drsScore,
            riskLevel: x?.manualRiskLevel ?? x?.derivedRiskLevel,
            createdAt: x.createdAt,
            components: x.components,
          }))}
          icon={<User3LineIcon />}
          title="CRA risk score"
        />
      )}
    </AsyncResourceRenderer>
  );
}
