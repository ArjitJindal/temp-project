import cn from 'clsx';
import s from './index.module.less';
import Label from '@/components/library/Label';
import { AsyncResource, isSuccess } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import { FlatFileProgressResponse } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import ValidationStats from '@/pages/transactions-import/DataValidationStep/ValidationStats';
import { isOngoingImport } from '@/pages/transactions-import/helpers';
import ProgressBar from '@/components/ui/ProgressBar';
import { downloadUrl } from '@/utils/browser';

type Props = {
  progressRes: AsyncResource<FlatFileProgressResponse>;
};

export default function DataValidationStep(props: Props) {
  const { progressRes } = props;
  return (
    <div className={cn(s.root)}>
      <AsyncResourceRenderer resource={progressRes}>
        {(progress) => {
          if (progress.isValidationJobFound === false) {
            return (
              <Card.Root>
                <Card.Section>
                  <P bold={true}>{'No import run'}</P>
                  <P>There were no import jobs run yet</P>
                </Card.Section>
              </Card.Root>
            );
          }
          if (progress.isValidationJobRunning) {
            return (
              <Label
                label="Data validation"
                description={
                  'There is ongoing data validation job. Please wait until it is completed. '
                }
              >
                <ValidationStats progressRes={progressRes} />
              </Label>
            );
          }
          if (isOngoingImport(progress)) {
            return (
              <Label
                label="Importing transaction"
                description={
                  'There is ongoing data importing job. Please wait until it is completed. '
                }
              >
                <ProgressBar
                  value={progress.processed ?? 0}
                  maxValue={progress.total}
                  showPercentage={true}
                />
              </Label>
            );
          }
          return (
            <Label
              label="Data validation"
              description={
                isSuccess(progressRes) && progressRes.value.erroredRecordsFileUrl
                  ? 'Valid rows are imported; a downloadable CSV is generated for rows with errors to enable quick correction and re-upload.'
                  : 'Valid rows are imported'
              }
            >
              <ValidationStats progressRes={progressRes} />
              {isSuccess(progressRes) && progressRes.value.erroredRecordsFileUrl != null && (
                <a
                  href={'#'}
                  onClick={(e) => {
                    e.preventDefault();
                    if (progressRes.value.erroredRecordsFileUrl) {
                      downloadUrl(
                        'transactions_import_errors.csv',
                        progressRes.value.erroredRecordsFileUrl,
                      );
                    }
                  }}
                >
                  Download CSV with errors
                </a>
              )}
            </Label>
          );
        }}
      </AsyncResourceRenderer>
    </div>
  );
}
