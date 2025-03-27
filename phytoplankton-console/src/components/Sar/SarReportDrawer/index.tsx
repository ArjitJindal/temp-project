import { createContext, useContext, useMemo, useState } from 'react';
import { isEmpty } from 'lodash';
import { useMutation } from '@tanstack/react-query';
import { useReportType } from '../utils';
import s from './style.module.less';
import Drawer from '@/components/library/Drawer';
import { Report, ReportStatus } from '@/apis';
import { useApi } from '@/api';
import StepButtons from '@/components/library/StepButtons';
import { dayjs, YEAR_MONTH_DATE_FORMAT } from '@/utils/dayjs';
import Button from '@/components/library/Button';
import { download, downloadUrl } from '@/utils/browser';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { useId } from '@/utils/hooks';
import SarReportDrawerForm from '@/components/Sar/SarReportDrawer/SarReportDrawerForm';
import { notEmpty } from '@/utils/array';
import { ObjectDefaultApi as FlagrightApi } from '@/apis/types/ObjectParamAPI';

const DISABLE_SUBMIT_STATUSES: ReportStatus[] = ['SUBMITTING', 'SUBMISSION_REJECTED'];

export type SarContextValue<MetaData extends Record<string, unknown> = Record<string, unknown>> = {
  report: Report;
  metaData: MetaData;
  setMetaData: (key: keyof MetaData, value: MetaData[keyof MetaData]) => void;
};

export const SarContext = createContext<SarContextValue<Record<string, unknown>> | null>(null);

export const useSarContext = <
  MetaData extends Record<string, unknown> = Record<string, unknown>,
>() => {
  const context = useContext(SarContext);
  if (!context) {
    return null;
  }
  return context as SarContextValue<MetaData>;
};

export const REPORT_STEP = 'REPORT_STEP';
export const DEFINITION_METADATA_STEP = 'DEFINITION_METADATA_STEP';
export const TRANSACTION_METADATA_STEP = 'TRANSACTION_METADATA_STEP';
export const CUSTOMER_AND_ACCOUNT_DETAILS_STEP = 'CUSTOMER_AND_ACCOUNT_DETAILS_STEP';
export const TRANSACTION_STEP = 'TRANSACTION_STEP';
export const CURRENCY_TRANSACTION_STEP = 'CURRENCY_TRANSACTION_STEP';
export const INDICATOR_STEP = 'INDICATOR_STEP';
export const ATTACHMENTS_STEP = 'ATTACHMENTS_STEP';

export type Step = {
  key: string;
  title: string;
  description: string;
};

interface Props {
  initialReport: Report;
  isVisible: boolean;
  onChangeVisibility: (isVisible: boolean) => void;
}

async function downloadReport(report: Report, api: FlagrightApi) {
  const revision = report.revisions[report.revisions.length - 1];
  const output = revision.output;
  if (output?.startsWith('s3')) {
    const match = output.match(/^s3:(.+?):(.+)$/);
    if (match) {
      const [_, bucket, key] = match;
      const { url } = await api.getPresignedDownloadUrl({ bucket, key });
      downloadUrl(key, url);
    } else {
      console.error(`Unable to parse S3 link: ${output}`);
      throw new Error(`Unable to parse report output format`);
    }
  } else if (output) {
    const reportName = `SAR-report-${dayjs(revision.createdAt).format(YEAR_MONTH_DATE_FORMAT)}.xml`;
    download(reportName, output);
  } else {
    throw new Error(`XML output in response is empty, unable to download!`);
  }
}

export default function SarReportDrawer(props: Props) {
  const api = useApi();
  const steps = useMemo(
    (): Step[] =>
      [
        !isEmpty(props.initialReport.schema?.reportSchema) &&
          props.initialReport.schema !== undefined && {
            key: REPORT_STEP,
            title: 'General details',
            description: 'Enter reporting entity, person and report details',
          },
        !isEmpty(props.initialReport.schema?.customerAndAccountDetailsSchema) && {
          key: CUSTOMER_AND_ACCOUNT_DETAILS_STEP,
          title: 'Customer & Account details',
          description: 'Enter customer information and account holder details',
        },
        !isEmpty(props.initialReport.schema?.definitionsSchema) && {
          key: DEFINITION_METADATA_STEP,
          title: 'Definitions',
          description: 'Enter definitions of transactions that you want to report',
        },
        !isEmpty(props.initialReport.schema?.transactionMetadataSchema) && {
          key: TRANSACTION_METADATA_STEP,
          title: 'Suspicious activity details',
          description: 'Enter details of transactions that you want to report',
        },
        !isEmpty(props.initialReport.schema?.transactionSchema) && {
          key: TRANSACTION_STEP,
          title: 'Suspicious activity details',
          description: 'Enter details of transactions that you want to report',
        },
        !isEmpty(props.initialReport.schema?.indicators) && {
          key: INDICATOR_STEP,
          title: 'Indicators',
          description: 'Select one or more indicators that are relevant to your report',
        },
        !isEmpty(props.initialReport.schema?.currencyTransactionSchema) && {
          key: CURRENCY_TRANSACTION_STEP,
          title: 'Transaction activity details',
          description: 'Enter details of transactions that you want to report',
        },
        !(props.initialReport.schema?.settings?.disableAttachmentsStep === true) && {
          key: ATTACHMENTS_STEP,
          title: 'Attachments',
          description: 'Upload any supporting documents for your report',
        },
      ].filter(notEmpty),
    [props.initialReport.schema],
  );
  const reportType = useReportType(props.initialReport.reportTypeId);
  const directSumission = reportType?.directSubmission ?? false;
  const [activeStep, setActiveStep] = useState<string>(steps[0].key);
  const [report, setReport] = useState(props.initialReport);
  const [draft, setDraft] = useState<Report>(props.initialReport);
  const [hasChanges, setHasChanges] = useState(false);

  const submitMutation = useMutation<
    Report,
    unknown,
    {
      report: Report;
    }
  >(
    async (event) => {
      const hideLoading = message.loading(directSumission ? 'Submitting...' : 'Generating...');
      try {
        const reportWithoutSchema = { ...event.report };
        reportWithoutSchema.schema = undefined;
        const result = await api.postReports({
          Report: reportWithoutSchema,
        });
        await downloadReport(result, api);
        return result;
      } finally {
        hideLoading();
      }
    },
    {
      onSuccess: (r) => {
        setReport(r);
        setHasChanges(false);
        message.success(
          `Report ${r.id} successfully ${directSumission ? 'submitted' : 'generated'}`,
        );
      },
      onError: (e) => {
        message.error(`Failed to submit report`, { details: getErrorMessage(e) });
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
        setDraft(r);
        setHasChanges(false);
        message.success(`Draft of report saved successfully!`);
      },
      onError: (e) => {
        message.fatal(`Failed to save draft of report: ${getErrorMessage(e)}`);
      },
    },
  );

  const activeStepIndex = steps.findIndex(({ key }) => key === activeStep);
  const formId = useId(`form-`);
  const [metaData, setMetaData] = useState<Record<string, unknown>>({});
  return (
    <SarContext.Provider
      value={{
        report: props.initialReport,
        metaData,
        setMetaData: (key, value) => setMetaData((prev) => ({ ...prev, [key]: value })),
      }}
    >
      <Drawer
        isVisible={props.isVisible}
        onChangeVisibility={props.onChangeVisibility}
        title={'SAR report'}
        hasChanges={hasChanges}
        footer={
          <div className={s.footer}>
            <StepButtons
              nextDisabled={activeStepIndex === steps.length - 1}
              prevDisabled={activeStepIndex === 0}
              onNext={() => {
                setActiveStep(steps[activeStepIndex + 1].key);
              }}
              onPrevious={() => {
                setActiveStep(steps[activeStepIndex - 1].key);
              }}
            />
            <div className={s.footerButtons}>
              {!DISABLE_SUBMIT_STATUSES.includes(report.status) && (
                <Button
                  isLoading={saveDraftMutation.isLoading}
                  type="TETRIARY"
                  onClick={() => saveDraftMutation.mutate({ report: draft })}
                >
                  {'Save draft'}
                </Button>
              )}

              <Button
                type="TETRIARY"
                isDisabled={props.initialReport.revisions.length === 0}
                onClick={() => downloadReport(props.initialReport, api)}
              >
                Download
              </Button>
              <Button
                isLoading={submitMutation.isLoading}
                type="PRIMARY"
                htmlAttrs={{
                  form: formId,
                }}
                htmlType={'submit'}
                isDisabled={directSumission && DISABLE_SUBMIT_STATUSES.includes(report.status)}
              >
                {directSumission ? 'Submit' : 'Generate report'}
              </Button>
            </div>
          </div>
        }
      >
        <SarReportDrawerForm
          report={report}
          formId={formId}
          steps={steps}
          activeStepState={[activeStep, setActiveStep]}
          onChange={(updatedReport) => {
            setDraft(updatedReport);
            setHasChanges(true);
          }}
          onSubmit={(report: Report) => {
            submitMutation.mutate({
              report,
            });
          }}
        />
      </Drawer>
    </SarContext.Provider>
  );
}
