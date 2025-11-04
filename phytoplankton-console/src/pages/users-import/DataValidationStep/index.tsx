import cn from 'clsx';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import Label from '@/components/library/Label';
import { AsyncResource, isSuccess } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import { FlatFileProgressResponse } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import ValidationStats from '@/pages/users-import/DataValidationStep/ValidationStats';
import { isOngoingImport } from '@/pages/users-import/helpers';
import ProgressBar from '@/components/ui/ProgressBar';
import { downloadUrl } from '@/utils/browser';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

type Props = {
  progressRes: AsyncResource<FlatFileProgressResponse>;
  userType: 'consumer' | 'business';
};

export default function DataValidationStep(props: Props) {
  const { progressRes, userType } = props;
  const settings = useSettings();
  const userTypeDisplay = firstLetterUpper(userType);

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
                <ValidationStats progressRes={progressRes} userType={userType} />
              </Label>
            );
          }
          if (isOngoingImport(progress)) {
            return (
              <Label
                label={`Importing ${userTypeDisplay} ${settings.userAlias}s`}
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
              <ValidationStats progressRes={progressRes} userType={userType} />
              {isSuccess(progressRes) && progressRes.value.erroredRecordsFileUrl != null && (
                <a
                  href={'#'}
                  onClick={(e) => {
                    e.preventDefault();
                    if (progressRes.value.erroredRecordsFileUrl) {
                      downloadUrl(
                        `${userType}_users_import_errors.csv`,
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
