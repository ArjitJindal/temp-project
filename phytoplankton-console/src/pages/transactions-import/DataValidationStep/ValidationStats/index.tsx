import cn from 'clsx';
import s from './index.module.less';
import CheckboxCircleFill from '@/components/ui/icons/Remix/system/checkbox-circle-fill.react.svg';
import AlertFill from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import ProgressBar from '@/components/ui/ProgressBar';
import { FileImportApiData } from '@/pages/transactions-import/helpers';

type Props = {
  progress: FileImportApiData;
};

export default function ValidationStats(props: Props) {
  const { progress } = props;
  return (
    <Card.Root>
      <Card.Section>
        <P bold={true}>{'Validation summary'}</P>
        {(progress.kind === 'VALIDATION_IN_PROGRESS' ||
          progress.kind === 'IMPORT_IN_PROGRESS' ||
          progress.kind === 'IMPORT_DONE') && (
          <ProgressBar
            value={progress.kind === 'IMPORT_DONE' ? progress.total : progress.processed}
            maxValue={progress.total}
            showPercentage={true}
            showValue={true}
          />
        )}
        {(progress.kind === 'VALIDATION_IN_PROGRESS' ||
          progress.kind === 'IMPORT_DONE' ||
          progress.kind === 'IMPORT_IN_PROGRESS') && (
          <div className={s.stats}>
            {progress?.succeeded != null && progress?.total != null && (
              <div className={cn(s.statsRow)}>
                <CheckboxCircleFill className={cn(s.statsIcon, s.success)} />
                <div>
                  {`${progress.succeeded}/${progress.total} rows ${
                    progress.kind === 'VALIDATION_IN_PROGRESS' ? 'validated' : 'imported'
                  } successfully.`}
                </div>
              </div>
            )}
            {progress?.errored != null && (
              <div className={cn(s.statsRow)}>
                <AlertFill className={cn(s.statsIcon, s.error)} />
                <div>{progress.errored} rows contains errors.</div>
              </div>
            )}
          </div>
        )}
      </Card.Section>
    </Card.Root>
  );
}
