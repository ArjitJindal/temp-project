import React, { forwardRef, useImperativeHandle } from 'react';
import { useLocalStorageState } from 'ahooks';
import Breadcrumbs, { BreadcrumbItem } from 'src/components/library/Breadcrumbs';
import { Link } from 'react-router-dom';
import s from './styles.module.less';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { PAGE_WRAPPER_PADDING } from '@/components/PageWrapper';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SIMULATION_COUNT } from '@/utils/queries/keys';
import { SimulationPageWrapper } from '@/components/SimulationPageWrapper';

export type SimulationPageWrapperRef = {
  refetchSimulationCount: () => void;
};

export type RulesPageWrapperProps = {
  breadcrumbs: BreadcrumbItem[];
  children?: React.ReactNode;
};

export const RulesPageWrapper = forwardRef<SimulationPageWrapperRef, RulesPageWrapperProps>(
  (props, ref) => {
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
      'SIMULATION_RULES',
      false,
    );
    return (
      <SimulationPageWrapper
        key={`${isSimulationEnabled}`}
        isSimulationModeEnabled={isSimulationEnabled}
        onSimulationModeChange={setIsSimulationEnabled}
        header={(actionButton) => (
          <div style={{ padding: `12px ${PAGE_WRAPPER_PADDING}px` }} className={s.header}>
            <Breadcrumbs items={props.breadcrumbs} />
            <div className={s.right}>
              {isSimulationEnabled && <Link to="/rules/simulation-history">View history</Link>}
              {actionButton}
            </div>
          </div>
        )}
      >
        {props.children}
      </SimulationPageWrapper>
    );
  },
);
