import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import { useFeatureEnabled } from '../AppWrapper/Providers/SettingsProvider';
import PageWrapper, { PageWrapperProps } from '../PageWrapper';
import { Authorized } from '../utils/Authorized';
import s from './styles.module.less';
import Toggle from '@/components/library/Toggle';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { getBranding } from '@/utils/branding';
import { SIMULATION_COUNT } from '@/utils/queries/keys';
import Tooltip from '@/components/library/Tooltip';
import Label from '@/components/library/Label';

export type SimulationPageWrapperRef = {
  refetchSimulationCount: () => void;
};

export type SimulationPageWrapperProps = PageWrapperProps & {
  header?: (actionButtons: React.ReactNode) => JSX.Element;
  onSimulationModeChange: (value: boolean | undefined) => void;
  isSimulationModeEnabled: boolean;
};

export const SimulationPageWrapper = forwardRef<
  SimulationPageWrapperRef,
  SimulationPageWrapperProps
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
  const branding = getBranding();
  const SIMULATOR_DISABLED_TOOLTIP_MESSAGE = useMemo(
    () => `This is an advanced feature. Please contact ${branding.supportEmail} to enable it.`,
    [branding.supportEmail],
  );
  const actionButton = (
    <div className={s.simulationRoot}>
      <Authorized minRequiredResources={['read:::simulator/simulations/*']}>
        <div className={s.right}>
          <Label label="Simulator" position="RIGHT">
            {!isSimulationFeatureEnabled ? (
              <div>
                <Tooltip title={SIMULATOR_DISABLED_TOOLTIP_MESSAGE} placement="bottomLeft">
                  <span>
                    <Toggle size="S" isDisabled={true} />
                  </span>
                </Tooltip>
              </div>
            ) : (
              <Toggle
                size="S"
                value={props.isSimulationModeEnabled}
                onChange={props.onSimulationModeChange}
                testId="simulation-toggle"
              />
            )}
          </Label>
        </div>
      </Authorized>
    </div>
  );
  return (
    <PageWrapper
      {...props}
      header={props.header && props.header(actionButton)}
      actionButton={actionButton}
    >
      {props.children}
    </PageWrapper>
  );
});
