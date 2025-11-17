import s from './index.module.less';
import { AsyncResource } from '@/utils/asyncResource';
import { FlatFileProgressResponse } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import ProgressBar from '@/components/ui/ProgressBar';
import Label from '@/components/library/Label';

type Props = {
  progressRes: AsyncResource<FlatFileProgressResponse>;
};

const DataValidationStep = ({ progressRes }: Props) => {
  return (
    <Card.Root className={s.root}>
      <AsyncResourceRenderer resource={progressRes}>
        {(progress) => {
          if (!progress) {
            return (
              <>
                <P bold className={s.title}>
                  {'No import run'}
                </P>
                <P>There were no import jobs run yet</P>
              </>
            );
          } else {
            return (
              <Label
                label="Importing search terms"
                description={'There is ongoing importing. Please wait until it is completed. '}
              >
                <ProgressBar
                  value={Math.min(progress.processed ?? 0, 99)}
                  maxValue={progress.total || undefined}
                  showPercentage
                />
              </Label>
            );
          }
        }}
      </AsyncResourceRenderer>
    </Card.Root>
  );
};

export default DataValidationStep;
