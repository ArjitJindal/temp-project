import GroupUserIcon from '@/components/ui/icons/group-user.react.svg';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useHasResources } from '@/utils/user-utils';
import { useUserKrsRiskScore } from '@/utils/api/users';

interface Props {
  userId: string;
}

export default function KycRiskDisplay({ userId }: Props) {
  const queryResult = useUserKrsRiskScore(userId);
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
