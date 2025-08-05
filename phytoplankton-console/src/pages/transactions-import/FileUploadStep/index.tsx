import { useState } from 'react';

import s from './index.module.less';
import SelectionGroup from '@/components/library/SelectionGroup';
import Label from '@/components/library/Label';
import TextArea from '@/components/library/TextArea';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import * as Card from '@/components/ui/Card';

const TEMPLATE_OPTIONS = [
  {
    value: 'FLAGRIGHT_TEMPLATE',
    label: 'Using Flagright CSV template',
    description:
      'Use our standard CSV template with predefined headers and structure for a fast and seamless import.',
    isDisabled: true,
    tooltip: 'Not available yet',
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
  },
];

type TemplateOptionValue = typeof TEMPLATE_OPTIONS[number]['value'];

export default function FileUploadStep() {
  const [template, setTemplate] = useState<TemplateOptionValue>();
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
          {template === 'CUSTOM_CSV' && (
            <>
              <FilesDraggerInput
                size={'LARGE'}
                value={[]}
                accept={['text/csv']}
                onChange={() => {
                  throw new Error('Not implemented');
                }}
              />
            </>
          )}
          <Label label="Import reason">
            <TextArea />
          </Label>
        </div>
      </Card.Section>
    </Card.Root>
  );
}
