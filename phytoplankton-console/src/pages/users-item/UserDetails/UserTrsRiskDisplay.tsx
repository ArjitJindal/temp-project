import { useApi } from '@/api';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { USER_TRS_RISK_SCORES } from '@/utils/queries/keys';

type Props = {
  userId: string;
};

export const UserTrsRiskDisplay: React.FC<Props> = ({ userId }) => {
  const api = useApi();

  const queryResult = useQuery(USER_TRS_RISK_SCORES(userId), () => api.getTrsScores({ userId }));

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(result) => (
        <RiskScoreDisplay
          icon={<User3LineIcon />}
          values={[{ score: result.average, createdAt: Date.now() }]}
          title="Average TRS risk score"
          riskScoreName="Average TRS risk score"
          showFormulaBackLink
          riskScoreAlgo={() => result.average}
        />
      )}
    </AsyncResourceRenderer>
  );
};
