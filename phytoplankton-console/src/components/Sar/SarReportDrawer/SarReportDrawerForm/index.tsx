import { JsonSchemaEditorSettings } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/settings';
import { StatePair } from '@/utils/state';
import { FileInfo, Report } from '@/apis';
import Form from '@/components/library/Form';
import Stepper from '@/components/library/Stepper';
import NestedForm from '@/components/library/Form/NestedForm';
import GenericFormField, { FormFieldRenderProps } from '@/components/library/Form/GenericFormField';
import {
  ATTACHMENTS_STEP,
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

const settings: Partial<JsonSchemaEditorSettings> = {};

export type FormState = Partial<{
  [REPORT_STEP]: unknown;
  [TRANSACTION_METADATA_STEP]: unknown;
  [TRANSACTION_STEP]: {
    [transactionId: string]: unknown;
  };
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

  return (
    <Form
      id={formId}
      initialValues={initialValues}
      onChange={({ values }) => {
        onChange(serializeFormState(report, values));
      }}
      onSubmit={(values) => {
        onSubmit(serializeFormState(report, values));
      }}
    >
      <Stepper steps={steps} active={activeStep} onChange={setActiveStep}>
        {(activeStepKey) => {
          return (
            <NestedForm<any> name={activeStepKey}>
              {activeStepKey == REPORT_STEP && (
                <ReportStep parametersSchema={report.schema?.reportSchema} settings={settings} />
              )}
              {activeStepKey == TRANSACTION_METADATA_STEP && (
                <ReportStep
                  parametersSchema={report.schema?.transactionMetadataSchema}
                  settings={settings}
                />
              )}
              {activeStepKey === TRANSACTION_STEP && (
                <TransactionStep settings={settings} report={report} />
              )}
              {activeStepKey === INDICATOR_STEP && (
                <GenericFormField<any> name={'selection'}>
                  {(props: FormFieldRenderProps<string[]>) => (
                    <IndicatorsStep report={report} {...props} />
                  )}
                </GenericFormField>
              )}
              {activeStepKey === ATTACHMENTS_STEP && <AttachmentsStep />}
            </NestedForm>
          );
        }}
      </Stepper>
    </Form>
  );
}

function deserializeFormState(reportTemplate: Report): FormState {
  return {
    [REPORT_STEP]: reportTemplate?.parameters.report,
    [TRANSACTION_METADATA_STEP]: reportTemplate?.parameters.transactionMetadata,
    [TRANSACTION_STEP]: reportTemplate?.parameters.transactions?.reduce((acc, x) => {
      return {
        ...acc,
        [x.id]: x.transaction,
      };
    }, {}),
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
      transactions: Object.entries(formState[TRANSACTION_STEP] ?? {}).map(([id, transaction]) => ({
        id,
        transaction,
      })),
    },
    attachments: formState.ATTACHMENTS_STEP?.files,
  };
}
