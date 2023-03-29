import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import RiskClassification from './RiskClassification';
import { SimulateRiskClassification } from './SimulateRiskClassification';
import { parseApiState, State } from './RiskClassificationTable';
import { useI18n } from '@/locales';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { usePageViewTracker } from '@/utils/tracker';
import SimulationPageWrapper, {
  SimulationPageWrapperRef,
} from '@/components/SimulationPageWrapper';
import { useApi } from '@/api';
import { getOr, isFailed, isSuccess } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import { RISK_CLASSIFICATION_VALUES } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';

export default function () {
  const i18n = useI18n();
  usePageViewTracker('Risk Algorithm');

  const [isSimulationEnabled, setIsSimulationEnabled] = useLocalStorageState<boolean>(
    'SIMULATION_RISK_LEVELS',
    false,
  );

  const pageWrapperRef = useRef<SimulationPageWrapperRef>(null);

  const refetchSimulationCount = useCallback(() => {
    pageWrapperRef.current?.refetchSimulationCount();
  }, []);

  const api = useApi();
  const [state, setState] = useState<State | null>(null);
  const [newState, setNewState] = useState<State | null>(null);
  const riskValuesQueryResults = useQuery(RISK_CLASSIFICATION_VALUES(), () =>
    api.getPulseRiskClassification(),
  );

  useEffect(() => {
    if (state == null) {
      if (getOr(riskValuesQueryResults.data, []) && isSuccess(riskValuesQueryResults.data)) {
        setState(parseApiState(riskValuesQueryResults.data.value));
        setNewState(parseApiState(riskValuesQueryResults.data.value));
      }
    } else {
      setNewState(state);
    }

    if (isFailed(riskValuesQueryResults.data)) {
      message.error('Failed to fetch risk values');
    }
  }, [state, riskValuesQueryResults.data]);

  return (
    <Feature name="PULSE" fallback={'Not enabled'}>
      <SimulationPageWrapper
        title={i18n(`menu.risk-levels.configure${isSimulationEnabled ? '.simulate' : ''}`)}
        description={
          isSimulationEnabled
            ? 'Test your risk level outputs by changing the risk score to make better decisions for the risk level configuration.'
            : 'Configure risk levels with score using the slider below.'
        }
        simulatorButton={true}
        isSimulationEnabled={isSimulationEnabled}
        setIsSimulationEnabled={setIsSimulationEnabled}
        ref={pageWrapperRef}
      >
        <div style={{ maxWidth: isSimulationEnabled ? '100%' : 800 }}>
          {!isSimulationEnabled ? (
            <RiskClassification
              state={newState}
              setState={setState}
              riskValuesRefetch={riskValuesQueryResults.refetch}
              riskValues={getOr(riskValuesQueryResults.data, [])}
            />
          ) : (
            <SimulateRiskClassification
              refetchSimulationCount={refetchSimulationCount}
              riskValuesRefetch={riskValuesQueryResults.refetch}
              defaultState={newState}
            />
          )}
        </div>
      </SimulationPageWrapper>
    </Feature>
  );
}
