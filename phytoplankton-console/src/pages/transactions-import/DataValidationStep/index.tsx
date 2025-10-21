import cn from 'clsx';
import s from './index.module.less';
import Label from '@/components/library/Label';
import { AsyncResource } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import ValidationStats from '@/pages/transactions-import/DataValidationStep/ValidationStats';
import { FlatImportProgress } from '@/pages/transactions-import/helpers';
import ProgressBar from '@/components/ui/ProgressBar';
import { downloadUrl } from '@/utils/browser';
import { neverReturn } from '@/utils/lang';

type Props = {
  progressRes: AsyncResource<FlatImportProgress>;
};

export default function DataValidationStep(props: Props) {
  const { progressRes } = props;
  return (
    <div className={cn(s.root)}>
      <AsyncResourceRenderer resource={progressRes}>
        {(progress) => {
          if (progress.kind === 'UPLOADING') {
            return (
              <Card.Root>
                <Card.Section>
                  <P bold={true}>{'Data validation'}</P>
                  <P>File pre-processing is in progress...</P>
                </Card.Section>
              </Card.Root>
            );
          }
          if (progress.kind === 'WAITING_FOR_JOB_START') {
            return (
              <Card.Root>
                <Card.Section>
                  <P bold={true}>{'Data validation'}</P>
                  <P>Waiting for import to start...</P>
                </Card.Section>
              </Card.Root>
            );
          }
          const { value: apiProgress } = progress;
          if (apiProgress.kind === 'NOT_FOUND') {
            return (
              <Card.Root>
                <Card.Section>
                  <P bold={true}>{'No import run'}</P>
                  <P>There were no import jobs run yet</P>
                </Card.Section>
              </Card.Root>
            );
          }
          if (apiProgress.kind === 'VALIDATION_PENDING') {
            return (
              <Card.Root>
                <Card.Section>
                  <P bold={true}>{'Data validation'}</P>
                  <P>Waiting for data validation job to start...</P>
                </Card.Section>
              </Card.Root>
            );
          }
          if (apiProgress.kind === 'VALIDATION_IN_PROGRESS') {
            return (
              <Label
                label="Data validation"
                description={'There is ongoing import. Please wait until it is completed. '}
              >
                <ValidationStats progress={apiProgress} />
              </Label>
            );
          }
          if (apiProgress.kind === 'IMPORT_IN_PROGRESS') {
            return (
              <Label
                label="Importing transaction"
                description={'There is ongoing importing. Please wait until it is completed. '}
              >
                <ProgressBar
                  value={Math.min(apiProgress.processed ?? 0, 99)}
                  maxValue={apiProgress.total}
                  showPercentage={true}
                />
              </Label>
            );
          }
          if (apiProgress.kind === 'IMPORT_DONE') {
            return (
              <Label
                label="Import finished"
                description={
                  apiProgress.errorsFileUrl
                    ? 'Valid rows are imported; a downloadable CSV is generated for rows with errors to enable quick correction and re-upload.'
                    : 'Valid rows are imported'
                }
              >
                <ValidationStats progress={apiProgress} />
                {apiProgress.errorsFileUrl != null && (
                  <a
                    href={'#'}
                    onClick={(e) => {
                      e.preventDefault();
                      if (apiProgress.errorsFileUrl) {
                        downloadUrl('transactions_import_errors.csv', apiProgress.errorsFileUrl);
                      }
                    }}
                  >
                    Download CSV with errors
                  </a>
                )}
              </Label>
            );
          }
          return neverReturn(apiProgress, <></>);
        }}
      </AsyncResourceRenderer>
    </div>
  );
}
