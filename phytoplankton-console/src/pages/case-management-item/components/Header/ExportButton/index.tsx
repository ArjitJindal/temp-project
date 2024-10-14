import React, { useRef, useState } from 'react';
import { Popover } from 'antd';
import s from './index.module.less';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select'; // Import Select component
import { useApi } from '@/api'; // Import useApi hook
import { useMutation } from '@/utils/queries/mutations/hooks'; // Import useMutation from the specified module
import { message } from '@/components/library/Message';
import { downloadUrl } from '@/utils/browser';
import { dayjs } from '@/utils/dayjs';
import Button from '@/components/library/Button';
import { isLoading } from '@/utils/asyncResource';

interface FormValues {
  exportFormat: 'XLSX';
}

interface Props {
  caseId: string;
}

function ExportButton(props: Props) {
  const { caseId } = props;

  const [isVisible, setIsVisible] = useState(false);

  const api = useApi(); // Initialize the API hook

  const mutation = useMutation(
    async (_reportData: FormValues) => {
      const afterTimestamp = dayjs().subtract(30, 'day').valueOf();
      const report = await api.createCaseReport({ caseId: caseId, afterTimestamp: afterTimestamp }); // Call the API to create a report
      downloadUrl(undefined, report.downloadUrl);
    },
    {
      onSuccess: () => {
        message.success('Report created successfully!'); // Show success message
        setIsVisible(false);
      },
      onError: (error) => {
        message.error(`Failed to create report: ${error}`); // Show error message
      },
    },
  );

  const formRef = useRef<FormRef<FormValues>>();

  const popoverTargetRef = useRef(null);

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      visible={isVisible}
      onVisibleChange={setIsVisible}
      getPopupContainer={() => {
        if (popoverTargetRef.current) {
          return popoverTargetRef.current;
        }
        return document.body;
      }}
      content={
        <div className={s.root}>
          <Form<FormValues>
            ref={formRef}
            initialValues={{ exportFormat: 'XLSX' }}
            onSubmit={(values, { isValid }) => {
              if (isValid) {
                mutation.mutate(values);
              }
            }}
          >
            <InputField<FormValues> name="exportFormat" label="Export format">
              {(inputProps) => (
                <Select
                  {...inputProps}
                  isDisabled={true}
                  options={[{ value: 'XLSX', label: 'XLSX' }]}
                />
              )}
            </InputField>
            <div>
              <Button htmlType={'submit'} isLoading={isLoading(mutation.dataResource)}>
                Download
              </Button>
            </div>
          </Form>
        </div>
      }
    >
      <div ref={popoverTargetRef}>
        <Button type="TETRIARY">Export</Button>
      </div>
    </Popover>
  );
}

export default ExportButton;
