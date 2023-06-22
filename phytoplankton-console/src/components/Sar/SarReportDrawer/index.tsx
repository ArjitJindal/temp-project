import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import s from './style.module.less';
import Drawer from '@/components/library/Drawer';
import { Report } from '@/apis';
import { useApi } from '@/api';
import StepButtons from '@/components/library/StepButtons';
import { dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';
import Button from '@/components/library/Button';
import { download } from '@/utils/browser';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useId } from '@/utils/hooks';
import SarReportDrawerForm from '@/components/Sar/SarReportDrawer/SarReportDrawerForm';

export const REPORT_STEP = 'REPORT_STEP';
export const TRANSACTION_STEP = 'TRANSACTION_STEP';
export const INDICATOR_STEP = 'INDICATOR_STEP';
export const VERSION_STEP = 'VERSION_STEP';

export const STEPS = [
  {
    key: REPORT_STEP,
    title: 'General Details',
    description: 'Enter reporting entity, person and report details',
  },
  {
    key: TRANSACTION_STEP,
    title: 'Transaction Details',
    description: 'Enter details of transactions that you want to report',
  },
  {
    key: INDICATOR_STEP,
    title: 'Indicators',
    description: 'Select one or more indicators that are relevant to your report',
  },
  {
    key: VERSION_STEP,
    title: 'Versions',
    description: 'View the version history for this report',
  },
];

interface Props {
  initialReport: Report;
  isVisible: boolean;
  onChangeVisibility: (isVisible: boolean) => void;
}

export default function SarReportDrawer(props: Props) {
  const api = useApi();
  const [activeStep, setActiveStep] = useState<string>(STEPS[0].key);
  const [report, setReport] = useState(props.initialReport);
  const [draft, setDraft] = useState<Report>(props.initialReport);
  const [dirty, setDirty] = useState(props.initialReport.revisions.length === 0);
  const submitMutation = useMutation<
    Report,
    unknown,
    {
      report: Report;
    }
  >(
    async (event) => {
      const reportWithoutSchema = { ...event.report };
      reportWithoutSchema.schema = undefined;
      const result = await api.postReports({
        Report: reportWithoutSchema,
      });
      const reportName = `SAR-report-${dayjs().format(YEAR_MONTH_DATE_FORMAT)}.xml`;
      const output = result.revisions[result.revisions.length - 1].output;
      if (output) {
        download(reportName, output);
      } else {
        throw new Error(`XML output in response is empty, unable to download!`);
      }
      return result;
    },
    {
      onSuccess: (r) => {
        setReport(r);
        setDirty(false);
      },
      onError: (e) => {
        message.fatal(`Failed to submit report: ${getErrorMessage(e)}`);
      },
    },
  );

  const saveDraftMutation = useMutation<
    Report,
    unknown,
    {
      report: Report;
    }
  >(
    async (event) => {
      const reportWithoutSchema = { ...event.report };
      reportWithoutSchema.schema = undefined;

      if (!report.id) {
        throw new Error('Report ID is not defined!');
      }

      const result = await api.postReportsReportIdDraft({
        reportId: report.id,
        Report: reportWithoutSchema,
      });
      return result;
    },
    {
      onSuccess: (r) => {
        setReport(r);
        setDirty(false);
        message.success(`Draft of report saved successfully!`);
      },
      onError: (e) => {
        message.fatal(`Failed to save draft of report: ${getErrorMessage(e)}`);
      },
    },
  );

  const activeStepIndex = STEPS.findIndex(({ key }) => key === activeStep);

  const formId = useId(`form-`);

  return (
    <Drawer
      isVisible={props.isVisible}
      onChangeVisibility={props.onChangeVisibility}
      title={'Report Generator'}
      footer={
        <div className={s.footer}>
          <StepButtons
            nextDisabled={activeStepIndex === STEPS.length - 1}
            prevDisabled={activeStepIndex === 0}
            onNext={() => {
              setActiveStep(STEPS[activeStepIndex + 1].key);
            }}
            onPrevious={() => {
              setActiveStep(STEPS[activeStepIndex - 1].key);
            }}
          />
          <div className={s.footerButtons}>
            <Button
              isLoading={saveDraftMutation.isLoading}
              type="TETRIARY"
              onClick={() => saveDraftMutation.mutate({ report: draft })}
            >
              {'Save draft'}
            </Button>

            <Button
              isLoading={submitMutation.isLoading}
              type="PRIMARY"
              htmlAttrs={{
                form: formId,
              }}
              htmlType={'submit'}
              isDisabled={!dirty}
            >
              {'Generate report'}
            </Button>
          </div>
        </div>
      }
    >
      <SarReportDrawerForm
        report={report}
        formId={formId}
        activeStepState={[activeStep, setActiveStep]}
        onChange={(report) => {
          setDirty(true);
          setDraft(report);
        }}
        onSubmit={(report: Report) => {
          submitMutation.mutate({
            report,
          });
        }}
      />
    </Drawer>
  );
}
