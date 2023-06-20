import { useState } from 'react';
import VersionHistory from '../../VersionHistory';
import { JsonSchemaEditorSettings } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/settings';
import { StatePair } from '@/utils/state';
import { Report } from '@/apis';
import Form from '@/components/library/Form';
import Stepper from '@/components/library/Stepper';
import NestedForm from '@/components/library/Form/NestedForm';
import JsonSchemaEditor from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor';
import VerticalMenu from '@/components/library/VerticalMenu';
import GenericFormField, { FormFieldRenderProps } from '@/components/library/Form/GenericFormField';
import {
  INDICATOR_STEP,
  REPORT_STEP,
  STEPS,
  TRANSACTION_STEP,
  VERSION_STEP,
} from '@/components/Sar/SarReportDrawer';
import IndicatorsStep from '@/components/Sar/SarReportDrawer/SarReportDrawerForm/IndicatorsStep';
import ReportStep from '@/components/Sar/SarReportDrawer/SarReportDrawerForm/ReportStep';

const settings: Partial<JsonSchemaEditorSettings> = { propertyNameStyle: 'SNAKE_CASE' };
type FormState = Partial<{
  [REPORT_STEP]: unknown;
  [TRANSACTION_STEP]: {
    [transactionId: string]: unknown;
  };
  [INDICATOR_STEP]: {
    selection: string[];
  };
  [VERSION_STEP]: unknown;
}>;

export default function SarReportDrawerForm(props: {
  formId: string;
  report: Report;
  activeStepState: StatePair<string>;
  onSubmit: (formState: Report) => void;
  onChange: () => void;
}) {
  const { formId, report, activeStepState, onSubmit, onChange } = props;
  const transactionIds = report.parameters.transactions.map((t) => t.id);
  const [activeStep, setActiveStep] = activeStepState;
  const initialValues = deserializeFormState(report);
  const [activeTransaction, setActiveTransaction] = useState<string>(transactionIds[0]);

  return (
    <Form
      id={formId}
      initialValues={initialValues}
      onChange={onChange}
      onSubmit={(values) => {
        onSubmit(serializeFormState(report, values));
      }}
    >
      <Stepper steps={STEPS} active={activeStep} onChange={setActiveStep}>
        {(activeStepKey) => {
          return (
            <NestedForm<any> name={activeStepKey}>
              {activeStepKey == REPORT_STEP && <ReportStep report={report} settings={settings} />}
              {activeStepKey == TRANSACTION_STEP && (
                <VerticalMenu
                  items={transactionIds.map((tid) => ({ key: tid, title: `Transaction ${tid}` }))}
                  active={activeTransaction}
                  onChange={setActiveTransaction}
                >
                  <NestedForm name={activeTransaction}>
                    <JsonSchemaEditor
                      settings={settings}
                      parametersSchema={report?.schema?.transactionSchema}
                    />
                  </NestedForm>
                </VerticalMenu>
              )}
              {activeStepKey == INDICATOR_STEP && (
                <GenericFormField<any> name={'selection'}>
                  {(props: FormFieldRenderProps<string[]>) => {
                    const { value = [], onChange } = props;
                    return <IndicatorsStep report={report} value={value} onChange={onChange} />;
                  }}
                </GenericFormField>
              )}
              {activeStepKey === VERSION_STEP && <VersionHistory report={report} />}
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
    [TRANSACTION_STEP]: reportTemplate?.parameters.transactions.reduce((acc, x) => {
      return {
        ...acc,
        [x.id]: x.transaction,
      };
    }, {}),
    [INDICATOR_STEP]: {
      selection: reportTemplate?.parameters.indicators,
    },
  };
}

export function serializeFormState(originalReport: Report, formState: FormState): Report {
  return {
    ...originalReport,
    parameters: {
      report: formState[REPORT_STEP],
      indicators: formState[INDICATOR_STEP]?.selection ?? [],
      transactions: Object.entries(formState[TRANSACTION_STEP] ?? {}).map(([id, transaction]) => ({
        id,
        transaction,
      })),
    },
  };
}
