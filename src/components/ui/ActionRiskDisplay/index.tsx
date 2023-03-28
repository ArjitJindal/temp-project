import React from 'react';
import Icon from './icon.react.svg';
import { useApi } from '@/api';
import { TRANSACTIONS_ITEM_RISKS_ARS } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';

interface Props {
  transactionId: string;
}

export default function ActionRiskDisplay({ transactionId }: Props) {
  const api = useApi();

  const queryResult = useQuery(TRANSACTIONS_ITEM_RISKS_ARS(transactionId), () =>
    api.getArsValue({ transactionId }),
  );

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(result) => (
        <RiskScoreDisplay
          title="Transaction risk score (TRS)"
          icon={<Icon />}
          values={
            result?.arsScore
              ? [
                  {
                    value: result.arsScore,
                    riskLevel: result.riskLevel,
                    createdAt: result.createdAt,
                    components: result.components,
                  },
                ]
              : []
          }
        />
      )}
    </AsyncResourceRenderer>
  );
}
