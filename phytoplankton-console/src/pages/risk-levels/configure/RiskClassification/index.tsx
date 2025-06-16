import { useMutation } from '@tanstack/react-query';
import RiskClassificationTable, {
  ApiState,
  State,
  parseApiState,
  prepareApiState,
} from '../RiskClassificationTable';
import s from './index.module.less';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { useHasResources } from '@/utils/user-utils';
import { RiskClassificationScore } from '@/apis';
import { message } from '@/components/library/Message';
import { PageWrapperContentContainer } from '@/components/PageWrapper';

type Props = {
  riskValues: RiskClassificationScore[];
  state: State | null;
  setState: React.Dispatch<React.SetStateAction<State | null>>;
  riskValuesRefetch: () => void;
};

export default function RiskQualification(props: Props) {
  const api = useApi();
  const hasRiskLevelPermission = useHasResources(['write:::risk-scoring/risk-levels/*']);
  const { riskValues, state, setState, riskValuesRefetch } = props;

  const saveRiskValuesMutation = useMutation<ApiState, Error, State>(
    (state) => api.postPulseRiskClassification({ RiskClassificationScore: prepareApiState(state) }),
    {
      onSuccess: () => {
        message.success('Risk values saved successfully');
        riskValuesRefetch();
      },
      onError: (e) => {
        const error = e instanceof Error ? e.message : 'Unable to save risk values';
        message.fatal(error, e);
      },
    },
  );

  async function handleSave() {
    if (state == null) {
      return;
    }

    saveRiskValuesMutation.mutate(state);
  }

  function handleCancel() {
    setState(parseApiState(riskValues));
  }

  // todo: i18n
  return (
    <PageWrapperContentContainer>
      <div className={s.header}>
        <Button type="PRIMARY" onClick={handleSave} isDisabled={!riskValues.length}>
          Save
        </Button>
        <Button onClick={handleCancel} isDisabled={!riskValues.length}>
          Cancel
        </Button>
      </div>
      <RiskClassificationTable
        state={state}
        setState={setState}
        isDisabled={!riskValues.length || !hasRiskLevelPermission}
      />
    </PageWrapperContentContainer>
  );
}
