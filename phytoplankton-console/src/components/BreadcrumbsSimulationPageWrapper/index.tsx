import React, { forwardRef, useImperativeHandle } from 'react';
import { useLocalStorageState } from 'ahooks';
import Breadcrumbs, { BreadcrumbItem } from 'src/components/library/Breadcrumbs';
import { Link, useLocation } from 'react-router-dom';
import s from './styles.module.less';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_COUNT } from '@/utils/queries/keys';
import { SimulationPageWrapper } from '@/components/SimulationPageWrapper';
import EyeLineIcon from '@/components/ui/icons/Remix/system/eye-line.react.svg';

export type SimulationPageWrapperRef = {
  refetchSimulationCount: () => void;
  onChange?: () => void;
};

export type PageWrapperProps = {
  breadcrumbs: BreadcrumbItem[];
  children?: React.ReactNode;
  simulationHistoryUrl: string;
  storageKey: 'SIMULATION_RULES' | 'SIMULATION_RISK_FACTORS';
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

  const location = useLocation();

  return (
    <SimulationPageWrapper
      key={`${isSimulationEnabled}`}
      isSimulationModeEnabled={isSimulationEnabled}
      onSimulationModeChange={setIsSimulationEnabled}
      header={(actionButton) => (
        <div className={s.header}>
          <Breadcrumbs items={props.breadcrumbs} />
          <div className={s.right}>
            {!location.pathname.endsWith('/simulation-history') && isSimulationEnabled && (
              <Link to={props.simulationHistoryUrl} className={s.history}>
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
