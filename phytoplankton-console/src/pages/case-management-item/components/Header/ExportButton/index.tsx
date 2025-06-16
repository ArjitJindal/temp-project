import React, { useRef, useState } from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import Popover from '@/components/ui/Popover';
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
import Checkbox from '@/components/library/Checkbox';
import NestedForm from '@/components/library/Form/NestedForm';
import Label from '@/components/library/Label';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import BasicInputField from '@/components/library/Form/BasicInputField';
import { UseFormState } from '@/components/library/Form/utils';
import { Case } from '@/apis';

interface FormValues {
  exportFormat: 'XLSX';
  toExport: {
    userOrPaymentDetails: boolean;
    activity: boolean;
    transactions: boolean;
    alertDetails: boolean;
    ontology: boolean;
  };
}

interface Props {
  caseItem: Case;
}

function ExportButton(props: Props) {
  const { caseItem } = props;
  const { caseId = '' } = caseItem;

  const [isVisible, setIsVisible] = useState(false);

  const isOntologyAvailable = useFeatureEnabled('ENTITY_LINKING');
  const isAlertDetailsAvailable = caseItem.caseType !== 'MANUAL';

  const api = useApi(); // Initialize the API hook

  const mutation = useMutation(
    async (reportData: FormValues) => {
      const afterTimestamp = dayjs().subtract(30, 'day').valueOf();
      const report = await api.createCaseReport({
        caseId: caseId,
        CreateCaseParams: {
          afterTimestamp: afterTimestamp,
          addUserOrPaymentDetails: reportData.toExport.userOrPaymentDetails,
          addActivity: reportData.toExport.activity,
          addTransactions: reportData.toExport.transactions,
          addAlertDetails: reportData.toExport.alertDetails,
          addOntology: reportData.toExport.ontology,
        },
      }); // Call the API to create a report
      downloadUrl(undefined, report.downloadUrl);
    },
    {
      onSuccess: () => {
        message.info('Report created successfully');
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
            key={caseId}
            ref={formRef}
            formValidators={[
              (formValues: FormValues) => {
                return Object.values(formValues.toExport).some(Boolean)
                  ? null
                  : 'Nothing to export';
              },
            ]}
            initialValues={{
              exportFormat: 'XLSX',
              toExport: {
                userOrPaymentDetails: true,
                activity: true,
                transactions: true,
                alertDetails: isAlertDetailsAvailable,
                ontology: isOntologyAvailable,
              },
            }}
            onSubmit={(values, { isValid }) => {
              if (isValid) {
                mutation.mutate(values);
              }
            }}
          >
            <InputField<FormValues, 'exportFormat'> name="exportFormat" label="Export format">
              {(inputProps) => (
                <Select
                  {...inputProps}
                  mode={'SINGLE'}
                  isDisabled={true}
                  options={[{ value: 'XLSX', label: 'XLSX' }]}
                />
              )}
            </InputField>
            <Label label={'To export'}>
              <NestedForm<FormValues> name={'toExport'}>
                <BasicInputField<FormValues['toExport'], 'userOrPaymentDetails'>
                  name={'userOrPaymentDetails'}
                  label={humanizeAuto('userOrPaymentDetails')}
                  labelProps={{ position: 'RIGHT', level: 2 }}
                  input={Checkbox}
                />
                <BasicInputField<FormValues['toExport'], 'activity'>
                  name={'activity'}
                  label={humanizeAuto('activity')}
                  labelProps={{ position: 'RIGHT', level: 2 }}
                  input={Checkbox}
                />
                <BasicInputField<FormValues['toExport'], 'transactions'>
                  name={'transactions'}
                  label={humanizeAuto('transactions')}
                  labelProps={{ position: 'RIGHT', level: 2 }}
                  input={Checkbox}
                />
                {isAlertDetailsAvailable && (
                  <BasicInputField<FormValues['toExport'], 'alertDetails'>
                    name={'alertDetails'}
                    label={humanizeAuto('alertDetails')}
                    labelProps={{ position: 'RIGHT', level: 2 }}
                    input={Checkbox}
                  />
                )}
                {isOntologyAvailable && (
                  <BasicInputField<FormValues['toExport'], 'ontology'>
                    name={'ontology'}
                    label={humanizeAuto('ontology')}
                    labelProps={{ position: 'RIGHT', level: 2 }}
                    input={Checkbox}
                  />
                )}
              </NestedForm>
            </Label>
            <div>
              <UseFormState<FormValues>>
                {({ isValid }) => (
                  <Button
                    htmlType={'submit'}
                    isLoading={isLoading(mutation.dataResource)}
                    isDisabled={!isValid}
                  >
                    Download
                  </Button>
                )}
              </UseFormState>
            </div>
          </Form>
        </div>
      }
    >
      <div ref={popoverTargetRef}>
        <Button type="TETRIARY" requiredResources={['write:::case-management/case-details/*']}>
          Export
        </Button>
      </div>
    </Popover>
  );
}

export default ExportButton;
