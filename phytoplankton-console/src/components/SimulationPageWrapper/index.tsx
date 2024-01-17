import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import AsyncResourceRenderer from '../common/AsyncResourceRenderer';
import { useFeatureEnabled, useSettings } from '../AppWrapper/Providers/SettingsProvider';
import { H4, P } from '../ui/Typography';
import PageWrapper, { PageWrapperProps } from '../PageWrapper';
import s from './styles.module.less';
import Button from '@/components/library/Button';
import Toggle from '@/components/library/Toggle';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { getBranding } from '@/utils/branding';
import { SIMULATION_COUNT } from '@/utils/queries/keys';
import Tooltip from '@/components/library/Tooltip';

export type SimulationPageWrapperRef = {
  refetchSimulationCount: () => void;
};

export type SimulationPageWrapperProps = PageWrapperProps & {
  isSimulationModeEnabled: boolean;
  onSimulationModeChange: (value: boolean | undefined) => void;
  onCreateRule?: () => void;
};

const SimulationUsageCard = (props: { usageCount: number }) => {
  const settings = useSettings();
  const branding = getBranding();

  const remainingSimulations = !settings?.limits?.simulations
    ? 0
    : Math.max(settings.limits.simulations - props.usageCount, 0);
  return (
    <div className={s.card}>
      <P className={s.title}>Simulations</P>
      <H4 className={s.count}>
        {`${remainingSimulations} left`}
        <a className={s.buyMore} href={`mailto:${branding.supportEmail}`} target="_blank">
          Buy more
        </a>
      </H4>
    </div>
  );
};

export const SimulationPageWrapper = forwardRef<
  SimulationPageWrapperRef,
  SimulationPageWrapperProps
>((props, ref) => {
  const api = useApi();
  const isSimulationFeatureEnabled = useFeatureEnabled('SIMULATOR');
  const v8Enabled = useFeatureEnabled('RULES_ENGINE_V8');
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
  return (
    <PageWrapper
      {...props}
      superAdminMode={
        props.isSimulationModeEnabled
          ? {
              tooltip:
                'Turn on to make the simulation jobs triggered from super admin users visible.',
            }
          : undefined
      }
      actionButton={
        <div className={s.simulationRoot}>
          {isSimulationFeatureEnabled && props.isSimulationModeEnabled && (
            <AsyncResourceRenderer resource={simulationCountResults.data}>
              {(data) => <SimulationUsageCard usageCount={data.runJobsCount} />}
            </AsyncResourceRenderer>
          )}
          <div className={s.right}>
            <div className={s.simulationSwitch}>
              <p className={s.simulationSwitchTitle}>Simulator</p>
              {!isSimulationFeatureEnabled ? (
                <div>
                  <Tooltip title={SIMULATOR_DISABLED_TOOLTIP_MESSAGE} placement="left">
                    <span>
                      <Toggle disabled={true} />
                    </span>
                  </Tooltip>
                </div>
              ) : (
                <Toggle
                  value={props.isSimulationModeEnabled}
                  onChange={props.onSimulationModeChange}
                  disabled={false}
                />
              )}
            </div>
            {v8Enabled && props.onCreateRule && (
              <Button
                type="SECONDARY"
                onClick={props.onCreateRule}
                testName="create-scenario-button"
              >
                Create rule
              </Button>
            )}
          </div>
        </div>
      }
    >
      {props.children}
    </PageWrapper>
  );
});
