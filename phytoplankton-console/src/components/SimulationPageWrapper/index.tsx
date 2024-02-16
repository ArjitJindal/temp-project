import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import AsyncResourceRenderer from '../utils/AsyncResourceRenderer';
import { useFeatureEnabled, useSettings } from '../AppWrapper/Providers/SettingsProvider';
import { P } from '../ui/Typography';
import PageWrapper, { PageWrapperProps } from '../PageWrapper';
import s from './styles.module.less';
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
};

const SimulationUsageCard = (props: { usageCount: number }) => {
  const settings = useSettings();
  const branding = getBranding();

  const remainingSimulations = !settings?.limits?.simulations
    ? 0
    : Math.max(settings.limits.simulations - props.usageCount, 0);
  return (
    <div className={`${s.card} ${s.extraMargin}`}>
      <P className={s.title}> {`${remainingSimulations} Simulations left`}</P>
      <a className={s.buyMore} href={`mailto:${branding.supportEmail}`} target="_blank">
        Buy more
      </a>
    </div>
  );
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
  return (
    <PageWrapper
      {...props}
      superAdminMode={{
        tooltip: 'Turn on to make the simulation jobs triggered from super admin users visible.',
      }}
      actionButton={
        <div className={s.simulationRoot}>
          <div className={s.right}>
            <div className={s.simulationSwitch}>
              <div className={s.card}>
                <div className={s.switchCard}>
                  <p className={s.simulationSwitchTitle}>Simulator</p>
                  {!isSimulationFeatureEnabled ? (
                    <div>
                      <Tooltip title={SIMULATOR_DISABLED_TOOLTIP_MESSAGE} placement="left">
                        <span>
                          <Toggle size="SMALL" disabled={true} />
                        </span>
                      </Tooltip>
                    </div>
                  ) : (
                    <Toggle
                      size="SMALL"
                      value={props.isSimulationModeEnabled}
                      onChange={props.onSimulationModeChange}
                      disabled={false}
                    />
                  )}
                </div>
                {isSimulationFeatureEnabled && props.isSimulationModeEnabled && (
                  <AsyncResourceRenderer resource={simulationCountResults.data}>
                    {(data) => <SimulationUsageCard usageCount={data.runJobsCount} />}
                  </AsyncResourceRenderer>
                )}
              </div>
            </div>
          </div>
        </div>
      }
    >
      {props.children}
    </PageWrapper>
  );
});
