import React from 'react';
import { useUserTrsScores } from '@/hooks/api/users';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import RiskScoreDisplay from '@/components/ui/RiskScoreDisplay';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

type Props = {
  userId: string;
};

export const UserTrsRiskDisplay: React.FC<Props> = ({ userId }) => {
  const queryResult = useUserTrsScores(userId);

  return (
    <AsyncResourceRenderer resource={queryResult.data} renderLoading={() => <></>}>
      {(result) => (
        <RiskScoreDisplay
          icon={<User3LineIcon />}
          values={[{ score: result.average, createdAt: Date.now() }]}
          title="Average TRS risk score"
          riskScoreName="Average TRS risk score"
          showFormulaBackLink
          riskScoreAlgo={() => result.average}
          hideInfo={true}
        />
      )}
    </AsyncResourceRenderer>
  );
};
