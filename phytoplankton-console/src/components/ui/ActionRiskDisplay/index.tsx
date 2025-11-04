import React from 'react';
import Icon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import { useTransactionARS } from '@/utils/api/alerts';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import { useHasResources } from '@/utils/user-utils';

interface Props {
  transactionId: string;
}

export default function ActionRiskDisplay({ transactionId }: Props) {
  const queryResult = useTransactionARS(transactionId);

  const isArsPermissionEnabled = useHasResources(['read:::risk-scoring/risk-score-details/*']);

  return (
    <AsyncResourceRenderer resource={queryResult.data} renderLoading={() => <></>}>
      {(result) =>
        result && (
          <RiskScoreDisplay
            title="Transaction risk score (TRS)"
            icon={<Icon />}
            values={
              result?.arsScore
                ? [
                    {
                      score: result.arsScore,
                      createdAt: result.createdAt,
                      components: result.components,
                      factorScoreDetails: result.factorScoreDetails,
                    },
                  ]
                : []
            }
            riskScoreName="TRS"
            showFormulaBackLink
            riskScoreAlgo={(value) => value.score}
            hideInfo={!isArsPermissionEnabled}
          />
        )
      }
    </AsyncResourceRenderer>
  );
}
