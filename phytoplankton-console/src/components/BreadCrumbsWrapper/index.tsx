import React, { forwardRef, useCallback, useImperativeHandle } from 'react';
import Breadcrumbs, { BreadcrumbItem } from 'src/components/library/Breadcrumbs';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import s from './styles.module.less';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_COUNT } from '@/utils/queries/keys';
import {
  ImportExportType,
  TopRightSection,
  VersionHistoryType,
} from '@/components/TopRightSection';
import EyeLineIcon from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import { useSafeLocalStorageState } from '@/utils/hooks';
import { SimulationLocalStorageKey } from '@/store/risk-factors';

export type TopRightSectionRef = {
  refetchSimulationCount: () => void;
  onChange?: () => void;
};

export type SimulationStorageKey =
  | 'SIMULATION_RULES'
  | 'SIMULATION_CUSTOM_RISK_FACTORS'
  | 'SIMULATION_RISK_LEVELS';

export type PageWrapperProps = {
  breadcrumbs: BreadcrumbItem[];
  children?: React.ReactNode;
  simulationHistoryUrl: string;
  simulationDefaultUrl: string;
  nonSimulationDefaultUrl: string;
  simulationStorageKey: SimulationStorageKey;
  importExport?: ImportExportType;
  className?: string;
  versionHistory?: VersionHistoryType;
};

export const BreadCrumbsWrapper = forwardRef<TopRightSectionRef, PageWrapperProps>((props, ref) => {
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

  const [isSimulationEnabled, setIsSimulationEnabled] = useSafeLocalStorageState<boolean>(
    props.simulationStorageKey,
    false,
  );
  const navigate = useNavigate();

  const handleSimulationModeChange = useCallback(
    (value: boolean | undefined) => {
      console.log('value', value);
      setIsSimulationEnabled(value);
      if (!value) {
        if (props.simulationStorageKey === 'SIMULATION_CUSTOM_RISK_FACTORS') {
          // Remove all simulation data from local storage
          const keysToRemove: string[] = [];

          // First, collect all keys to remove
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes(SimulationLocalStorageKey)) {
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
      props.simulationStorageKey,
    ],
  );

  const location = useLocation();
  console.log('props', props.children);
  console.log('isSimulationEnabled', isSimulationEnabled);
  return (
    <TopRightSection
      className={props.className}
      key={`${isSimulationEnabled}`}
      isSimulationModeEnabled={localStorage.getItem(props.simulationStorageKey) === 'true'}
      onSimulationModeChange={handleSimulationModeChange}
      versionHistory={props.versionHistory}
      importExport={props.importExport}
      header={(actionButton) => (
        <div className={s.header}>
          <Breadcrumbs items={props.breadcrumbs} />
          <div className={s.right}>
            {!location.pathname.endsWith('/simulation-history') &&
              localStorage.getItem(props.simulationStorageKey) === 'true' && (
                <Link
                  to={props.simulationHistoryUrl}
                  className={s.history}
                  data-cy="simulation-history-link"
                >
                  <EyeLineIcon className={s.icon} /> View history
                </Link>
              )}
            {actionButton}
          </div>
        </div>
      )}
    >
      {props.children}
    </TopRightSection>
  );
});
