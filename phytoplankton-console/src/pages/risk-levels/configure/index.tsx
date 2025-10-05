import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import RiskClassification from './RiskClassification';
import { SimulateRiskClassification } from './SimulateRiskClassification';
import { parseApiState, State } from './RiskClassificationTable';
import styles from './index.module.less';
import { Authorized } from '@/components/utils/Authorized';
import { TopRightSectionRef } from '@/components/TopRightSection';
import { isFailed, isSuccess } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import { useRiskClassificationConfig } from '@/hooks/api/risk-levels';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { makeUrl } from '@/utils/routing';
import { notEmpty } from '@/utils/array';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { Feature, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { isEqual } from '@/utils/lang';

type ScopeSelectorValue = 'risk-factor' | 'risk-level';

export default function () {
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');

  const isSimulationMode = localStorage.getItem('SIMULATION_RISK_LEVELS') === 'true';
  const isRiskFactorSimulationMode =
    localStorage.getItem('SIMULATION_CUSTOM_RISK_FACTORS') === 'true';
  const navigate = useNavigate();

  const handleTabChange = (key: ScopeSelectorValue) => {
    if (key === 'risk-level') {
      navigate(makeUrl('/risk-levels/configure'));
    } else {
      if (isRiskFactorSimulationMode) {
        navigate(makeUrl('/risk-levels/risk-factors/simulation'));
      } else {
        navigate(makeUrl('/risk-levels/risk-factors/consumer'));
      }
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
      <BreadCrumbsWrapper
        className={styles.breadcrumbsWrapper}
        simulationStorageKey="SIMULATION_RISK_LEVELS"
        nonSimulationDefaultUrl="/risk-levels/configure"
        simulationDefaultUrl="/risk-levels/configure/simulation"
        simulationHistoryUrl="/risk-levels/configure/simulation-history"
        versionHistory={{
          url: makeUrl('/risk-levels/version-history'),
        }}
        breadcrumbs={[
          {
            title: 'Risk scoring',
            to: isRiskFactorSimulationMode
              ? makeUrl('/risk-levels/risk-factors/simulation')
              : makeUrl('/risk-levels/risk-factors/consumer'),
          },
          {
            title: 'Risk levels',
            to: makeUrl(`/risk-levels/configure${isSimulationMode ? '/simulation' : ''}`),
          },
          isSimulationMode && {
            title: 'Simulate',
            to: makeUrl('/risk-levels/configure/simulation'),
          },
        ].filter(notEmpty)}
      >
        <Tabs
          defaultActiveKey="risk-level"
          activeKey="risk-level"
          type="line"
          items={tabItems}
          onChange={handleTabChange}
        />
      </BreadCrumbsWrapper>
    </Feature>
  );
}

function RiskLevelsConfigurePage({ isSimulationMode }: { isSimulationMode: boolean }) {
  const pageWrapperRef = useRef<TopRightSectionRef>(null);

  const refetchSimulationCount = useCallback(() => {
    pageWrapperRef.current?.refetchSimulationCount();
  }, []);

  const [state, setState] = useState<State | null>(null);
  const [newState, setNewState] = useState<State | null>(null);
  const riskConfig = useRiskClassificationConfig();

  useEffect(() => {
    if (isFailed(riskConfig.data as any)) {
      message.fatal('Failed to fetch risk values', new Error('Failed to fetch risk values'));
    }
    if (!isSuccess(riskConfig.data as any)) {
      return;
    }
    const newValue = riskConfig.data;
    const parsedState = parseApiState(newValue.classificationValues);
    if (!isEqual(parsedState, state)) {
      setState(parsedState);
      setNewState(parsedState);
    }
  }, [state, riskConfig.data]);

  return (
    <Authorized minRequiredResources={['read:::risk-scoring/risk-levels/*']} showForbiddenPage>
      <div>
        {!isSimulationMode ? (
          <RiskClassification
            riskValuesRefetch={riskConfig.refetch}
            state={newState}
            setState={setNewState}
            riskValues={riskConfig.data}
          />
        ) : (
          <SimulateRiskClassification
            refetchSimulationCount={refetchSimulationCount}
            riskValuesRefetch={riskConfig.refetch}
            defaultState={newState}
          />
        )}
      </div>
    </Authorized>
  );
}
