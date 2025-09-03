import cn from 'clsx';
import s from './index.module.less';
import CheckboxCircleFill from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import ErrorWarningFill from '@/components/ui/icons/Remix/system/error-warning-fill.react.svg';
import AlertFill from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import { AsyncResource } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import { FlatFileProgressResponse } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

type Props = {
  progressRes: AsyncResource<FlatFileProgressResponse>;
};

export default function ValidationStats(props: Props) {
  const { progressRes } = props;
  return (
    <AsyncResourceRenderer resource={progressRes}>
      {(progress) => (
        <Card.Root>
          <Card.Section>
            <P bold={true}>{'Validation summary'}</P>
            <div className={s.stats}>
              {progress.saved != null && progress.total != null && (
                <div className={cn(s.statsRow)}>
                  <CheckboxCircleFill className={cn(s.statsIcon, s.success)} />
                  <div>
                    {progress.saved}/{progress.total} rows imported successfully.
                  </div>
                </div>
              )}
              {false && (
                <div className={cn(s.statsRow)}>
                  <ErrorWarningFill className={cn(s.statsIcon, s.warning)} />
                  <div>12 duplicate rows are found and merged successfully.</div>
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
