import React from 'react';
import { useApi } from '@/api';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import { USERS_ITEM_RISKS_DRS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useHasPermissions } from '@/utils/user-utils';

interface Props {
  userId: string;
}

export default function DynamicRiskDisplay({ userId }: Props) {
  const api = useApi();

  const queryResult = useQuery(USERS_ITEM_RISKS_DRS(userId), () => api.getDrsValue({ userId }));
  const isDrsPermissionEnabled = useHasPermissions(['risk-scoring:risk-score-details:read']);

  return (
    <AsyncResourceRenderer resource={queryResult.data} renderLoading={() => <></>}>
      {(result) =>
        result?.length > 0 ? (
          <RiskScoreDisplay
            values={result?.map((x) => ({
              score: x.drsScore,
              manualRiskLevel: x?.manualRiskLevel,
              createdAt: x.createdAt,
              components: x.components,
              factorScoreDetails: x.factorScoreDetails,
              transactionId: x.transactionId,
            }))}
            icon={<User3LineIcon />}
            title="CRA risk score"
            riskScoreName="CRA risk score"
            showFormulaBackLink
            riskScoreAlgo={(value) => value.score}
            hideInfo={!isDrsPermissionEnabled}
          />
        ) : null
      }
    </AsyncResourceRenderer>
  );
}
