import { useState } from 'react';
import s from './index.module.less';
import { StatePair } from '@/utils/state';
import { FileInfo, Report } from '@/apis';
import Form from '@/components/library/Form';
import Stepper from '@/components/library/Stepper';
import NestedForm from '@/components/library/Form/NestedForm';
import GenericFormField, { FormFieldRenderProps } from '@/components/library/Form/GenericFormField';
import {
  ATTACHMENTS_STEP,
  CUSTOMER_AND_ACCOUNT_DETAILS_STEP,
  INDICATOR_STEP,
  REPORT_STEP,
  Step,
  TRANSACTION_METADATA_STEP,
  TRANSACTION_STEP,
} from '@/components/Sar/SarReportDrawer';
import IndicatorsStep from '@/components/Sar/SarReportDrawer/SarReportDrawerForm/IndicatorsStep';
import ReportStep from '@/components/Sar/SarReportDrawer/SarReportDrawerForm/ReportStep';
import TransactionStep from '@/components/Sar/SarReportDrawer/SarReportDrawerForm/TransactionStep';
import AttachmentsStep from '@/components/Sar/SarReportDrawer/SarReportDrawerForm/AttachmentsStep';
import { makeValidators } from '@/components/library/JsonSchemaEditor/utils';
import { PropertyItem } from '@/components/library/JsonSchemaEditor/types';
import { ObjectFieldValidator } from '@/components/library/Form/utils/validation/types';
import { message } from '@/components/library/Message';

export type FormState = Partial<{
  [REPORT_STEP]: unknown;
  [TRANSACTION_METADATA_STEP]: unknown;
  [CUSTOMER_AND_ACCOUNT_DETAILS_STEP]: unknown;
  [TRANSACTION_STEP]: {
    id: string;
  }[];
  [INDICATOR_STEP]: {
    selection: string[];
  };
  [ATTACHMENTS_STEP]: {
    files?: FileInfo[];
  };
}>;

interface Props {
  formId: string;
  report: Report;
  steps: Step[];
  activeStepState: StatePair<string>;
  onSubmit: (formState: Report) => void;
  onChange: (formState: Report) => void;
}

export default function SarReportDrawerForm(props: Props) {
  const { formId, report, steps, activeStepState, onSubmit, onChange } = props;
  const [activeStep, setActiveStep] = activeStepState;
  const initialValues = deserializeFormState(report);

  const settings = {
    propertyNameStyle: report.schema?.settings?.propertyNameStyle || 'AS_IS',
    collapseForNestedProperties: true,
  };

  const orderedProps: PropertyItem[] = [
    {
      name: REPORT_STEP,
      isRequired: false,
      schema: report.schema?.reportSchema,
    },
    {
      name: TRANSACTION_METADATA_STEP,
      isRequired: false,
      schema: report.schema?.transactionMetadataSchema,
    },
    {
      name: CUSTOMER_AND_ACCOUNT_DETAILS_STEP,
      isRequired: false,
      schema: report.schema?.customerAndAccountDetailsSchema,
    },
    ...(report.schema?.transactionSchema != null
      ? [
          {
            name: TRANSACTION_STEP,
            isRequired: false,
            schema: {
              type: 'array',
              items: report.schema.transactionSchema,
            },
          },
        ]
      : []),
  ].filter((x) => x.schema != null);

  const fieldValidators = makeValidators(orderedProps, {
    definitions: {
      type: 'object' as const,
      ...report.schema?.reportSchema?.definitions,
      ...report.schema?.transactionMetadataSchema?.definitions,
      ...report.schema?.transactionSchema?.definitions,
    },
  });

  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);

  return (
    <Form
      portaled
      id={formId}
      className={s.root}
      fieldValidators={fieldValidators as ObjectFieldValidator<FormState>}
      initialValues={initialValues}
      alwaysShowErrors={alwaysShowErrors}
      onChange={({ values }) => {
        onChange(serializeFormState(report, values));
      }}
      onSubmit={(values, { isValid }) => {
        if (isValid) {
          onSubmit(serializeFormState(report, values));
        } else {
          message.warn(
            'Please, make sure that all required fields are filled and values are valid!',
          );
          setAlwaysShowErrors(true);
        }
      }}
    >
      {({ validationResult }) => (
        <Stepper
          steps={steps.map((step) => ({
            ...step,
            isInvalid:
              alwaysShowErrors && validationResult?.fieldValidationErrors?.[step.key] != null,
          }))}
          active={activeStep}
          onChange={setActiveStep}
        >
          {(activeStepKey) => (
            <NestedForm<any> name={activeStepKey}>
              {activeStepKey == REPORT_STEP && (
                <ReportStep
                  validationResult={validationResult?.fieldValidationErrors?.[REPORT_STEP]}
                  parametersSchema={report.schema?.reportSchema}
                  settings={settings}
                  alwaysShowErrors={alwaysShowErrors}
                />
              )}
              {activeStepKey == TRANSACTION_METADATA_STEP && (
                <ReportStep
                  validationResult={
                    validationResult?.fieldValidationErrors?.[TRANSACTION_METADATA_STEP]
                  }
                  parametersSchema={report.schema?.transactionMetadataSchema}
                  settings={settings}
                  alwaysShowErrors={alwaysShowErrors}
                />
              )}
              {activeStepKey == CUSTOMER_AND_ACCOUNT_DETAILS_STEP && (
                <ReportStep
                  validationResult={
                    validationResult?.fieldValidationErrors?.[CUSTOMER_AND_ACCOUNT_DETAILS_STEP]
                  }
                  parametersSchema={report.schema?.customerAndAccountDetailsSchema}
                  settings={settings}
                  alwaysShowErrors={alwaysShowErrors}
                />
              )}
              {activeStepKey === TRANSACTION_STEP && (
                <TransactionStep
                  settings={settings}
                  report={report}
                  validationResult={validationResult?.fieldValidationErrors?.[TRANSACTION_STEP]}
                  alwaysShowErrors={alwaysShowErrors}
                />
              )}
              {activeStepKey === INDICATOR_STEP && (
                <GenericFormField<any> name={'selection'}>
                  {(props: FormFieldRenderProps<string[]>) => (
                    <IndicatorsStep report={report} {...props} />
                  )}
                </GenericFormField>
              )}
              {activeStepKey === ATTACHMENTS_STEP && (
                <AttachmentsStep reportTypeId={report.reportTypeId} />
              )}
            </NestedForm>
          )}
        </Stepper>
      )}
    </Form>
  );
}

function deserializeFormState(reportTemplate: Report): FormState {
  return {
    [REPORT_STEP]: reportTemplate?.parameters.report,
    [TRANSACTION_METADATA_STEP]: reportTemplate?.parameters.transactionMetadata,
    [CUSTOMER_AND_ACCOUNT_DETAILS_STEP]: reportTemplate?.parameters.customerAndAccountDetails,
    [TRANSACTION_STEP]: reportTemplate?.parameters.transactions?.map(({ id, transaction }) => ({
      id,
      ...transaction,
    })),
    [INDICATOR_STEP]: {
      selection: reportTemplate?.parameters.indicators ?? [],
    },
    [ATTACHMENTS_STEP]: {
      files: reportTemplate?.attachments ?? undefined,
    },
  };
}

export function serializeFormState(originalReport: Report, formState: FormState): Report {
  return {
    ...originalReport,
    parameters: {
      report: formState[REPORT_STEP],
      indicators: formState[INDICATOR_STEP]?.selection ?? [],
      transactionMetadata: formState[TRANSACTION_METADATA_STEP],
      customerAndAccountDetails: formState[CUSTOMER_AND_ACCOUNT_DETAILS_STEP],
      transactions: (formState[TRANSACTION_STEP] ?? []).map((transaction) => ({
        id: transaction.id,
        transaction,
      })),
    },
    attachments: formState.ATTACHMENTS_STEP?.files,
  };
}
