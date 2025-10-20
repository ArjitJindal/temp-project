import cn from 'clsx';
import s from './index.module.less';
import CheckboxCircleFill from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import ErrorWarningFill from '@/components/ui/icons/Remix/system/error-warning-fill.react.svg';
import AlertFill from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import { AsyncResource } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import ProgressBar from '@/components/ui/ProgressBar';
import { FlatImportProgress, isOngoingImport } from '@/pages/transactions-import/helpers';

type Props = {
  progressRes: AsyncResource<FlatImportProgress>;
};

export default function ValidationStats(props: Props) {
  const { progressRes } = props;
  return (
    <AsyncResourceRenderer resource={progressRes}>
      {(progress) => {
        const progressData = progress.kind === 'API_DATA' ? progress.value : undefined;
        return (
          <Card.Root>
            <Card.Section>
              <P bold={true}>{'Validation summary'}</P>
              {isOngoingImport(progress) && progressData != null && (
                <ProgressBar
                  value={progressData.processed ?? 0}
                  maxValue={progressData.isValidationJobRunning ? undefined : progressData.total}
                  showPercentage={true}
                  showValue={progressData.isValidationJobRunning}
                />
              )}
              <div className={s.stats}>
                {progressData?.saved != null && progressData?.total != null && (
                  <div className={cn(s.statsRow)}>
                    <CheckboxCircleFill className={cn(s.statsIcon, s.success)} />
                    <div>
                      {progressData.saved}/{progressData.total} rows imported successfully.
                    </div>
                  </div>
                )}
                {false && (
                  <div className={cn(s.statsRow)}>
                    <ErrorWarningFill className={cn(s.statsIcon, s.warning)} />
                    <div>12 duplicate rows are found and merged successfully.</div>
                  </div>
                )}
                {progressData?.errored != null && (
                  <div className={cn(s.statsRow)}>
                    <AlertFill className={cn(s.statsIcon, s.error)} />
                    <div>{progressData.errored} rows contains errors.</div>
                  </div>
                )}
              </div>
            </Card.Section>
          </Card.Root>
        );
      }}
    </AsyncResourceRenderer>
  );
}
