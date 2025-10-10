import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import RiskClassificationSimulationResults from '../RiskClassificationSimulationResults';
import { State } from '../RiskClassificationTable';
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
  const ref = useRef<SimulationRef>(null);
  const { type } = useParams();

  return (
    <Feature name="SIMULATOR">
      {type === 'simulation-history' ? (
        <SimulationHistory setResult={setResult} setOpen={setOpen} />
      ) : (
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
      )}
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
