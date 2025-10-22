import cn from 'clsx';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import CheckboxCircleFill from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import ErrorWarningFill from '@/components/ui/icons/Remix/system/error-warning-fill.react.svg';
import AlertFill from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import { AsyncResource } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import { FlatFileProgressResponse } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import ProgressBar from '@/components/ui/ProgressBar';
import { isOngoingImport } from '@/pages/users-import/helpers';

type Props = {
  progressRes: AsyncResource<FlatFileProgressResponse>;
  userType: 'consumer' | 'business';
};

export default function ValidationStats(props: Props) {
  const { progressRes, userType } = props;
  const userTypeDisplay = firstLetterUpper(userType);

  return (
    <AsyncResourceRenderer resource={progressRes}>
      {(progress) => (
        <Card.Root>
          <Card.Section>
            <P bold={true}>{'Validation summary'}</P>
            {isOngoingImport(progress) && (
              <ProgressBar
                value={progress.processed ?? 0}
                maxValue={progress.isValidationJobRunning ? undefined : progress.total}
                showPercentage={true}
                showValue={progress.isValidationJobRunning}
              />
            )}
            <div className={s.stats}>
              {progress.saved != null && progress.total != null && (
                <div className={cn(s.statsRow)}>
                  <CheckboxCircleFill className={cn(s.statsIcon, s.success)} />
                  <div>
                    {progress.saved}/{progress.total} {userTypeDisplay} users imported successfully.
                  </div>
                </div>
              )}
              {false && (
                <div className={cn(s.statsRow)}>
                  <ErrorWarningFill className={cn(s.statsIcon, s.warning)} />
                  <div>12 duplicate users are found and merged successfully.</div>
                </div>
              )}
              {progress.errored != null && (
                <div className={cn(s.statsRow)}>
                  <AlertFill className={cn(s.statsIcon, s.error)} />
                  <div>{progress.errored} rows contains errors.</div>
                </div>
              )}
            </div>
          </Card.Section>
        </Card.Root>
      )}
    </AsyncResourceRenderer>
  );
}
