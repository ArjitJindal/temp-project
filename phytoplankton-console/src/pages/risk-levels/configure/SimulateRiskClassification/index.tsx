import { Tabs } from 'antd';
import { useRef, useState } from 'react';
import _ from 'lodash';
import { useLocalStorageState } from 'ahooks';
import RiskClassificationSimulationResults from '../RiskClassificationSimulationResults';
import { State } from '../RiskClassificationTable';
import s from './styles.module.less';
import NewSimulation, { SimulationRef } from './NewSimulation';
import SimulationHistory from './SimulationHistory';
import { SimulationPostResponse } from '@/apis';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

type Props = {
  refetchSimulationCount: () => void;
  defaultState: State | null;
  riskValuesRefetch: () => void;
};

export const SimulateRiskClassification = (props: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SimulationPostResponse | null>(null);
  const [activeKey, setActiveKey] = useLocalStorageState<'NEW' | 'HISTORY'>(
    'SIMULATOR_RISK_LEVELS_ACTIVE_KEY',
    'NEW',
  );
  const ref = useRef<SimulationRef>(null);

  return (
    <Feature name="SIMULATOR">
      <Tabs
        defaultActiveKey={activeKey}
        className={s.tabsRoot}
        onChange={(key) => {
          if (key === 'NEW' || key === 'HISTORY') {
            setActiveKey(key);
          }
        }}
        activeKey={activeKey}
      >
        <Tabs.TabPane tab="New simulation" key="NEW">
          <NewSimulation
            ref={ref}
            setResult={setResult}
            refetchSimulationCount={props.refetchSimulationCount}
            defaultState={props.defaultState}
            riskValuesRefetch={props.riskValuesRefetch}
            onRun={() => {
              setOpen(true);
            }}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Simulation history" key="HISTORY" active={activeKey === 'HISTORY'}>
          <SimulationHistory setResult={setResult} setOpen={setOpen} />
        </Tabs.TabPane>
      </Tabs>
      {result && result.jobId && (
        <RiskClassificationSimulationResults
          onClose={(toClose) => {
            setOpen(toClose);
            ref.current?.reset();
          }}
          isVisible={open}
          result={result}
        />
      )}
    </Feature>
  );
};
