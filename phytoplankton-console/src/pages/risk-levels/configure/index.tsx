import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import RiskClassification from './RiskClassification';
import { SimulateRiskClassification } from './SimulateRiskClassification';
import { parseApiState, State } from './RiskClassificationTable';
import { Authorized } from '@/components/utils/Authorized';
import { SimulationPageWrapperRef } from '@/components/SimulationPageWrapper';
import { useApi } from '@/api';
import { getOr, isFailed, isSuccess } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import { RISK_CLASSIFICATION_VALUES } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { makeUrl } from '@/utils/routing';
import { notEmpty } from '@/utils/array';
import { BreadcrumbsSimulationPageWrapper } from '@/components/BreadcrumbsSimulationPageWrapper';
import { Feature, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

type ScopeSelectorValue = 'risk-factor' | 'risk-level';

export default function () {
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');

  const isSimulationMode = localStorage.getItem('SIMULATION_RISK_LEVELS') === 'true';
  const navigate = useNavigate();

  const handleTabChange = (key: ScopeSelectorValue) => {
    if (key === 'risk-level') {
      navigate(makeUrl('/risk-levels/configure'));
    } else {
      navigate(makeUrl('/risk-levels/risk-factors/consumer'));
    }
  };

  const tabItems: TabItem[] = [
    isRiskScoringEnabled && {
      title: 'Risk factors',
      children: null,
      key: 'risk-factor',
    },
    {
      title: 'Risk levels',
      children: <RiskLevelsConfigurePage isSimulationMode={isSimulationMode} />,
      key: 'risk-level',
    },
  ].filter(notEmpty);
  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <BreadcrumbsSimulationPageWrapper
        storageKey="SIMULATION_RISK_LEVELS"
        nonSimulationDefaultUrl="/risk-levels/configure"
        simulationDefaultUrl="/risk-levels/configure/simulation"
        simulationHistoryUrl="/risk-levels/configure/simulation-history"
        breadcrumbs={[
          { title: 'Risk scoring', to: makeUrl('/risk-levels') },
          { title: 'Risk levels', to: makeUrl('/risk-levels/configure') },
        ].filter(notEmpty)}
      >
        <Tabs
          defaultActiveKey="risk-level"
          activeKey="risk-level"
          type="line"
          items={tabItems}
          onChange={handleTabChange}
        />
      </BreadcrumbsSimulationPageWrapper>
    </Feature>
  );
}

function RiskLevelsConfigurePage({ isSimulationMode }: { isSimulationMode: boolean }) {
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
      message.fatal('Failed to fetch risk values', new Error('Failed to fetch risk values'));
    }
  }, [state, riskValuesQueryResults.data]);

  return (
    <Authorized required={['risk-scoring:risk-levels:read']} showForbiddenPage>
      <div style={{ maxWidth: isSimulationMode ? '100%' : 800 }}>
        {!isSimulationMode ? (
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
    </Authorized>
  );
}
