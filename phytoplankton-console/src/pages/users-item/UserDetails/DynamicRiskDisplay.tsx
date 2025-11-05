import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useHasResources } from '@/utils/user-utils';
import DynamicRiskHistoryDisplay from '@/components/ui/DynamicRiskHistoryDisplay';
import { useUserDrsRiskScore } from '@/utils/api/users';

interface Props {
  userId: string;
}

export default function DynamicRiskDisplay({ userId }: Props) {
  const queryResult = useUserDrsRiskScore(userId);
  const isDrsPermissionEnabled = useHasResources(['read:::risk-scoring/risk-score-details/*']);

  return (
    <AsyncResourceRenderer resource={queryResult.data} renderLoading={() => <></>}>
      {(result) =>
        result?.length > 0 ? (
          <DynamicRiskHistoryDisplay
            value={
              result?.map((x) => ({
                score: x.drsScore,
                manualRiskLevel: x?.manualRiskLevel,
                createdAt: x.createdAt,
                components: x.components,
                factorScoreDetails: x.factorScoreDetails,
                transactionId: x.transactionId,
              }))[0]
            }
            icon={<User3LineIcon />}
            title="CRA score"
            showFormulaBackLink
            riskScoreAlgo={(value) => value.score}
            hideInfo={!isDrsPermissionEnabled}
            userId={userId}
          />
        ) : null
      }
    </AsyncResourceRenderer>
  );
}
