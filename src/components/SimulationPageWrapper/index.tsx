import React, { forwardRef, useImperativeHandle } from 'react';
import cn from 'clsx';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../library/Button';
import ErrorBoundary from '../ErrorBoundary';
import Toggle from '../library/Toggle';
import AsyncResourceRenderer from '../common/AsyncResourceRenderer';
import { Feature, useFeatureEnabled, useSettings } from '../AppWrapper/Providers/SettingsProvider';
import { H2, H4, P } from '../ui/Typography';
import s from './styles.module.less';
import ArrowLeftSLine from '@/components/ui/icons/Remix/system/arrow-left-s-line.react.svg';
import { usePageTimeLoadTracker, usePageViewTimeTracker } from '@/utils/tracker';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { getBranding } from '@/utils/branding';
import { SIMULATION_COUNT } from '@/utils/queries/keys';

interface Props {
  title?: string;
  description?: string;
  backButton?: {
    title: string;
    url: string;
  };
  actionButton?: {
    title: string;
    url: string;
  };
  loading?: boolean;
  children?: React.ReactNode;
  simulatorButton?: boolean;
  isSimulationEnabled?: boolean;
  setIsSimulationEnabled?: (value: boolean | undefined) => void;
}

export type SimulationPageWrapperRef = {
  refetchSimulationCount: () => void;
};

const SimulationPageWrapper = forwardRef<SimulationPageWrapperRef, Props>((props, ref) => {
  const {
    title,
    description,
    backButton,
    actionButton,
    simulatorButton,
    isSimulationEnabled,
    setIsSimulationEnabled,
  } = props;

  const navigate = useNavigate();
  usePageViewTimeTracker();
  usePageTimeLoadTracker();
  const isSimulationFeatureEnabled = useFeatureEnabled('SIMULATOR');
  const api = useApi();
  const simulationCountResults = useQuery(SIMULATION_COUNT(), async () => {
    if (!isSimulationFeatureEnabled) {
      return { count: 0 };
    }
    return api.getSimulationJobsCount();
  });
  const settings = useSettings();
  const branding = getBranding();

  useImperativeHandle(ref, () => ({
    refetchSimulationCount: () => {
      simulationCountResults.refetch();
    },
  }));

  // todo: migration: check if something is broken
  return (
    <div className={s.root} id="page-wrapper-root">
      {(title || description || backButton || actionButton) && (
        <header className={s.head}>
          <div className={s.row}>
            <div className={s.col_18}>
              {title && (
                <H2 id={title} className={s.title}>
                  {title}
                </H2>
              )}
              {description && (
                <P variant="sml" className={s.description}>
                  {description}
                </P>
              )}

              {backButton && (
                <Link className={s.backButton} to={backButton.url}>
                  <ArrowLeftSLine />
                  {backButton.title}
                </Link>
              )}
            </div>
            <div className={s.col_6}>
              {actionButton && (
                <div style={{ textAlign: 'end' }}>
                  <Button
                    onClick={() => navigate(`/rules/request-new`, { replace: true })}
                    size="MEDIUM"
                    type="TETRIARY"
                  >
                    {actionButton.title}
                  </Button>
                </div>
              )}
              {simulatorButton && (
                <Feature name="SIMULATOR">
                  <div className={s.simulationRoot}>
                    <div className={s.card}>
                      <P className={s.title}>Simulations</P>
                      <AsyncResourceRenderer
                        resource={simulationCountResults.data}
                        renderLoading={() => <></>}
                      >
                        {(data) => (
                          <H4 className={s.count}>
                            {!settings?.limits?.simulations
                              ? 0
                              : Math.max(settings.limits.simulations - data.count, 0)}
                            {' left'}
                            <a
                              className={s.buyMore}
                              href={`mailto:${branding.supportEmail}`}
                              target="_blank"
                            >
                              Buy more
                            </a>
                          </H4>
                        )}
                      </AsyncResourceRenderer>
                    </div>
                    <div className={s.simulationSwitch}>
                      <p className={s.simulationSwitchTitle}>Simulator</p>
                      {setIsSimulationEnabled && (
                        <Toggle
                          value={isSimulationEnabled}
                          onChange={setIsSimulationEnabled}
                          green
                        />
                      )}
                    </div>
                  </div>
                </Feature>
              )}
            </div>
          </div>
        </header>
      )}
      <div className={cn(s.body, 'print-container')}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </div>
    </div>
  );
});

export default SimulationPageWrapper;
