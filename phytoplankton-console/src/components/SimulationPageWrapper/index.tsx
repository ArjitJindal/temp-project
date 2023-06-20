import { forwardRef, useImperativeHandle } from 'react';
import Toggle from '../library/Toggle';
import AsyncResourceRenderer from '../common/AsyncResourceRenderer';
import { useFeatureEnabled, useSettings } from '../AppWrapper/Providers/SettingsProvider';
import { H4, P } from '../ui/Typography';
import PageWrapper, { PageWrapperProps } from '../PageWrapper';
import s from './styles.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { getBranding } from '@/utils/branding';
import { SIMULATION_COUNT } from '@/utils/queries/keys';
import Tooltip from '@/components/library/Tooltip';

const SIMULATOR_DISABLED_TOOLTIP_MESSAGE =
  'This is an advanced feature. Please contact support@flagright.com to enable it.';

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
  const simulationCountResults = useQuery(SIMULATION_COUNT(), async () => {
    if (!isSimulationFeatureEnabled) {
      return { count: 0 };
    }
    return api.getSimulationJobsCount();
  });
  useImperativeHandle(ref, () => ({
    refetchSimulationCount: () => {
      simulationCountResults.refetch();
    },
  }));

  return (
    <PageWrapper
      {...props}
      actionButton={
        <div className={s.simulationRoot}>
          {isSimulationFeatureEnabled && props.isSimulationModeEnabled && (
            <AsyncResourceRenderer resource={simulationCountResults.data}>
              {(data) => <SimulationUsageCard usageCount={data.count} />}
            </AsyncResourceRenderer>
          )}
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
        </div>
      }
    />
  );
});
