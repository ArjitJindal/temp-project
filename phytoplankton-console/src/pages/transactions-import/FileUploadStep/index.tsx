import { useCallback, useState } from 'react';

import s from './index.module.less';
import SelectionGroup, { Option } from '@/components/library/SelectionGroup';
import Label from '@/components/library/Label';
import TextArea from '@/components/library/TextArea';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import * as Card from '@/components/ui/Card';
import Alert from '@/components/library/Alert';
import { useApi } from '@/api';
import { FileInfo } from '@/apis';
import { download } from '@/utils/browser';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { AsyncResource } from '@/utils/asyncResource';
import { FlatImportProgress } from '@/pages/transactions-import/helpers';

const TMP_IS_COMMENT_SUPPORTED = false;

type TemplateOptionValue = 'FLAGRIGHT_TEMPLATE' | 'SAVED_TEMPLATE' | 'CUSTOM_CSV';

interface Props {
  progressRes: AsyncResource<FlatImportProgress>;
  selectedFile: FileInfo | undefined;
  onFileUpload: (file: FileInfo | undefined) => void;
}

export default function FileUploadStep(props: Props) {
  const { selectedFile } = props;
  const [template, setTemplate] = useState<TemplateOptionValue | undefined>('FLAGRIGHT_TEMPLATE');
  const [errors, setErrors] = useState<string[]>([]);

  const api = useApi();
  const handleDownloadTemplate = useCallback(
    async (e) => {
      e.preventDefault();
      const dismissLoading = message.loading('Downloading template...');
      try {
        const response = await api.postFlatFilesGenerateTemplate({
          FlatFileTemplateRequest: {
            schema: 'TRANSACTIONS_UPLOAD',
            format: 'CSV',
          },
        });
        if (response.fileString) {
          download('flagright-transactions-template.csv', response.fileString);
        } else {
          message.error('Unable to fetch template file. Please try again later.');
        }
        message.success('You should receive a file in a few moments!');
      } catch (e) {
        message.error(`Failed to download template. ${getErrorMessage(e)}`);
      } finally {
        dismissLoading();
      }
    },
    [api],
  );

  const TEMPLATE_OPTIONS: Option<TemplateOptionValue>[] = [
    {
      value: 'FLAGRIGHT_TEMPLATE',
      label: 'Using Flagright CSV template',
      description: (
        <span>
          Use our standard{' '}
          <a href={'#'} onClick={handleDownloadTemplate}>
            CSV template
          </a>{' '}
          with predefined headers and structure for a fast and seamless import.
        </span>
      ),
    },
    {
      value: 'SAVED_TEMPLATE',
      label: 'Using saved CSV template',
      description:
        'Apply a previously saved mapping to a custom CSV you’ve used before. Great for recurring uploads.',
      isDisabled: true,
      tooltip: 'Not available yet',
    },
    {
      value: 'CUSTOM_CSV',
      label: 'Using custom CSV',
      description:
        'Upload your own CSV file. You’ll have to manually map the csv data to match our API schema.',
      isDisabled: true,
      tooltip: 'Not supported yet',
    },
  ];

  return (
    <Card.Root>
      <Card.Section>
        <div className={s.root}>
          <Label
            label="Import CSV file"
            description={'Select from an option below to upload your CSV data.'}
            required
          >
            <SelectionGroup<TemplateOptionValue>
              mode={'SINGLE'}
              value={template}
              onChange={(value) => {
                setTemplate(value);
              }}
              options={TEMPLATE_OPTIONS}
            />
          </Label>
          <>
            <FilesDraggerInput
              size={'LARGE'}
              singleFile={true}
              value={selectedFile ? [selectedFile] : []}
              accept={['text/csv']}
              onChange={(newValue) => {
                props.onFileUpload(newValue?.[0]);
              }}
              onShowErrorMessages={(messages) => {
                setErrors(messages);
              }}
            />
            {errors.length > 0 && (
              <Alert type={'ERROR'}>
                {errors.map((error, index) => (
                  <div key={index} className={s.error}>
                    {error}
                  </div>
                ))}
              </Alert>
            )}
          </>
          {TMP_IS_COMMENT_SUPPORTED && (
            <Label label="Import reason">
              <TextArea />
            </Label>
          )}
        </div>
      </Card.Section>
    </Card.Root>
  );
}
