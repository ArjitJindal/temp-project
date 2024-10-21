import React, { forwardRef, useCallback, useImperativeHandle } from 'react';
import { useLocalStorageState } from 'ahooks';
import Breadcrumbs, { BreadcrumbItem } from 'src/components/library/Breadcrumbs';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import s from './styles.module.less';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_COUNT } from '@/utils/queries/keys';
import { SimulationPageWrapper } from '@/components/SimulationPageWrapper';
import EyeLineIcon from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import { LocalStorageKey } from '@/pages/risk-levels/RiskFactorsSimulation/SimulationCustomRiskFactors/SimulationCustomRiskFactorsTable';

export type SimulationPageWrapperRef = {
  refetchSimulationCount: () => void;
  onChange?: () => void;
};

export type PageWrapperProps = {
  breadcrumbs: BreadcrumbItem[];
  children?: React.ReactNode;
  simulationHistoryUrl: string;
  simulationDefaultUrl: string;
  nonSimulationDefaultUrl: string;
  storageKey: 'SIMULATION_RULES' | 'SIMULATION_RISK_FACTORS' | 'SIMULATION_CUSTOM_RISK_FACTORS';
};

export const BreadcrumbsSimulationPageWrapper = forwardRef<
  SimulationPageWrapperRef,
  PageWrapperProps
>((props, ref) => {
  const api = useApi();
  const isSimulationFeatureEnabled = useFeatureEnabled('SIMULATOR');
  const simulationCountResults = useQuery(SIMULATION_COUNT(), async () => {
    if (!isSimulationFeatureEnabled) {
      return { runJobsCount: 0 };
    }
    return api.getSimulationJobsCount();
  });
  useImperativeHandle(ref, () => ({
    refetchSimulationCount: () => {
      simulationCountResults.refetch();
    },
  }));

  const [isSimulationEnabled, setIsSimulationEnabled] = useLocalStorageState<boolean>(
    props.storageKey,
    false,
  );
  const navigate = useNavigate();
  const handleSimulationModeChange = useCallback(
    (value: boolean | undefined) => {
      setIsSimulationEnabled(value);
      if (!value) {
        if (props.storageKey === 'SIMULATION_CUSTOM_RISK_FACTORS') {
          // Remove all simulation data from local storage
          const keysToRemove: string[] = [];

          // First, collect all keys to remove
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes(LocalStorageKey)) {
              keysToRemove.push(key);
            }
          }

          // Then, remove the collected keys
          keysToRemove.forEach((key) => {
            try {
              localStorage.removeItem(key);
            } catch (error) {
              console.error(`Failed to remove key ${key} from localStorage:`, error);
            }
          });
        }
        navigate(props.nonSimulationDefaultUrl);
      } else {
        navigate(props.simulationDefaultUrl);
      }
    },
    [
      navigate,
      setIsSimulationEnabled,
      props.nonSimulationDefaultUrl,
      props.simulationDefaultUrl,
      props.storageKey,
    ],
  );

  const location = useLocation();

  return (
    <SimulationPageWrapper
      key={`${isSimulationEnabled}`}
      isSimulationModeEnabled={isSimulationEnabled}
      onSimulationModeChange={handleSimulationModeChange}
      header={(actionButton) => (
        <div className={s.header}>
          <Breadcrumbs items={props.breadcrumbs} />
          <div className={s.right}>
            {!location.pathname.endsWith('/simulation-history') && isSimulationEnabled && (
              <Link
                to={props.simulationHistoryUrl}
                className={s.history}
                data-cy="simulation-history-link"
              >
                {' '}
                <EyeLineIcon className={s.icon} /> View history
              </Link>
            )}
            {actionButton}
          </div>
        </div>
      )}
    >
      {props.children}
    </SimulationPageWrapper>
  );
});
