import React, { useState, Fragment, useCallback } from 'react';
import { Button } from 'antd';
import { useMutation } from '@tanstack/react-query';
import Drawer from '@/components/library/Drawer';
import { Report } from '@/apis';
import { JsonSchemaForm } from '@/components/JsonSchemaForm';
import { useApi } from '@/api';
import Stepper from '@/components/library/Stepper';
import VerticalMenu from '@/components/library/VerticalMenu';
import Checkbox from '@/components/library/Checkbox';
import Label from '@/components/library/Label';
import VersionHistory from '@/components/Sar/VersionHistory';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

const REPORT_STEP = '1';
const TRANSACTION_STEP = '2';
const INDICATOR_STEP = '3';
const FINALIZE_STEP = '4';
export default function SarReportDrawer(props: {
  initialReport: Report;
  isVisible: boolean;
  onChangeVisibility: (isVisible: boolean) => void;
}) {
  const STEPS = [
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
      key: FINALIZE_STEP,
      title: 'Finalize',
      description: 'Finalize the report for sending',
    },
  ];
  const api = useApi();

  const { initialReport } = props;
  const [activeStep, setActiveStep] = useState<string>(STEPS[0].key);
  const [activeTransaction, setActiveTransaction] = useState<string>(
    initialReport.parameters.transactions[0].id,
  );

  const [report, setReport] = useState<Report>(initialReport);

  const [dirty, setDirty] = useState(false);

  const update = useMutation<Report, unknown>(
    async () => {
      return api.postReports({
        Report: report,
      });
    },
    {
      onSuccess: (r) => {
        message.success('Report generated!');
        setReport(r);
        setDirty(false);
      },
      onError: (error) => {
        message.fatal(`Unable generate report! ${getErrorMessage(error)}`, error);
      },
    },
  );

  const handleReportChange = useCallback((newFormDetails) => {
    setReport((report) => {
      setDirty(true);
      report.parameters.report = newFormDetails.formData;
      return { ...report };
    });
  }, []);

  const handleTransactionChange = useCallback(
    (newFormDetails) => {
      setReport((report) => {
        setDirty(true);
        report.parameters.transactions = report.parameters.transactions.map((t) => {
          if (t.id !== activeTransaction) {
            return t;
          }
          return { id: t.id, transaction: newFormDetails.formData };
        });

        return { ...report };
      });
    },
    [activeTransaction],
  );

  const handleIndicatorChange = (indicatorKey: string) => {
    return (v: boolean | undefined) =>
      v &&
      setReport((report) => {
        setDirty(true);
        let indicators = report.parameters.indicators;
        if (v) {
          indicators = [...report.parameters.indicators, indicatorKey];
        } else {
          indicators = indicators.splice(indicators.indexOf(indicatorKey), 1);
        }
        return {
          ...report,
          parameters: {
            ...report.parameters,
            indicators,
          },
        };
      });
  };

  const currentTransaction = report.parameters.transactions.find(
    (t) => t.id === activeTransaction,
  )?.transaction;
  return (
    <Drawer
      isVisible={props.isVisible}
      onChangeVisibility={props.onChangeVisibility}
      title={'Report Generator'}
    >
      {report && (
        <Stepper steps={STEPS} active={activeStep} onChange={setActiveStep}>
          {(activeStepKey) => {
            return (
              <>
                {activeStepKey == REPORT_STEP && (
                  <JsonSchemaForm
                    schema={report.schema?.reportSchema}
                    formData={report.parameters.report}
                    liveValidate={false}
                    onChange={handleReportChange}
                  >
                    {/* Add a dummy fragment for disabling the submit button */}
                    <Fragment />
                  </JsonSchemaForm>
                )}
                {activeStepKey == TRANSACTION_STEP && (
                  <VerticalMenu
                    items={report.parameters.transactions.map((t) => ({ key: t.id, title: t.id }))}
                    active={activeTransaction}
                    onChange={setActiveTransaction}
                  >
                    <JsonSchemaForm
                      schema={report.schema?.transactionSchema}
                      formData={currentTransaction}
                      liveValidate={false}
                      onChange={handleTransactionChange}
                    >
                      {/* Add a dummy fragment for disabling the submit button */}
                      <Fragment />
                    </JsonSchemaForm>
                  </VerticalMenu>
                )}
                {activeStepKey == INDICATOR_STEP &&
                  report.schema?.indicators.map((i) => (
                    <Label label={i.description} position="RIGHT" level={1}>
                      <Checkbox
                        value={report.parameters.indicators.indexOf(i.key) > -1}
                        onChange={handleIndicatorChange(i.key)}
                      />
                    </Label>
                  ))}
                {activeStepKey === FINALIZE_STEP && (
                  <>
                    <Button onClick={() => update.mutate()} disabled={!dirty}>
                      Generate
                    </Button>
                    <VersionHistory report={report} />
                  </>
                )}
              </>
            );
          }}
        </Stepper>
      )}
    </Drawer>
  );
}
