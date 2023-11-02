import { useRef, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import RiskClassificationSimulationResults from '../RiskClassificationSimulationResults';
import { State } from '../RiskClassificationTable';
import NewSimulation, { SimulationRef } from './NewSimulation';
import SimulationHistory from './SimulationHistory';
import { SimulationPostResponse } from '@/apis';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tabs, { TabItem } from '@/components/library/Tabs';

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
  const tabItems: TabItem[] = [
    {
      tab: 'New simulation',
      children: (
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
      ),
      key: 'NEW',
      isClosable: false,
    },
    {
      tab: 'Simulation history',
      children: <SimulationHistory setResult={setResult} setOpen={setOpen} />,
      key: 'HISTORY',
      isClosable: false,
    },
  ];
  const onChange = (key: string) => {
    if (key === 'NEW' || key === 'HISTORY') {
      setActiveKey(key);
    }
  };
  return (
    <Feature name="SIMULATOR">
      <Tabs
        activeKey={activeKey}
        type="line"
        items={tabItems}
        onChange={(key: string) => onChange(key)}
      />
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
