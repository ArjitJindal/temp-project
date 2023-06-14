import { useState, useEffect, Fragment, useCallback } from 'react';
import { Button } from 'antd';
import Drawer from '@/components/library/Drawer';
import { Report } from '@/apis';
import { JsonSchemaForm } from '@/components/JsonSchemaForm';
import { useApi } from '@/api';
import Stepper from '@/components/library/Stepper';
import VerticalMenu from '@/components/library/VerticalMenu';
import Checkbox from '@/components/library/Checkbox';
import Label from '@/components/library/Label';

const REPORT_STEP = '1';
const TRANSACTION_STEP = '2';
const INDICATOR_STEP = '3';
const FINALIZE_STEP = '4';
export default function SarReportDrawer(props: {
  caseId: string;
  schemaId: string;
  transactionIds: string[];
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
  const { caseId, schemaId, transactionIds } = props;
  const [reportTemplate, setReportTemplate] = useState<Report>();
  const [activeStep, setActiveStep] = useState<string>(STEPS[0].key);
  const [activeTransaction, setActiveTransaction] = useState<string>(transactionIds[0]);

  const onSubmit = () => {
    api
      .postReports({
        Report: reportTemplate,
      })
      .then(setReportTemplate);
  };

  const handleReportChange = useCallback((newFormDetails) => {
    setReportTemplate((report) => {
      if (!report) {
        return;
      }
      report.parameters.report = newFormDetails.formData;
      return { ...report };
    });
  }, []);

  const handleTransactionChange = useCallback(
    (newFormDetails) => {
      setReportTemplate((report) => {
        if (!report) {
          return;
        }
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
      setReportTemplate((report) => {
        if (!report) {
          return;
        }
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

  useEffect(() => {
    if (props.isVisible) {
      api
        .getReportsTemplate({
          caseId,
          schemaId,
          transactionIds,
        })
        .then(setReportTemplate);
    }
  }, [props.isVisible, api, caseId, schemaId, transactionIds]);

  const currentTransaction = reportTemplate?.parameters.transactions.find(
    (t) => t.id === activeTransaction,
  )?.transaction;
  return (
    <Drawer
      isVisible={props.isVisible}
      onChangeVisibility={props.onChangeVisibility}
      title={'Report Generator'}
    >
      {reportTemplate && (
        <Stepper steps={STEPS} active={activeStep} onChange={setActiveStep}>
          {(activeStepKey) => {
            return (
              <>
                {activeStepKey == REPORT_STEP && (
                  <>
                    <JsonSchemaForm
                      schema={reportTemplate.schema.reportSchema}
                      formData={reportTemplate?.parameters.report}
                      liveValidate={false}
                      onChange={handleReportChange}
                    >
                      {/* Add a dummy fragment for disabling the submit button */}
                      <Fragment />
                    </JsonSchemaForm>
                  </>
                )}
                {activeStepKey == TRANSACTION_STEP && (
                  <VerticalMenu
                    items={transactionIds.map((tid) => ({ key: tid, title: tid }))}
                    active={activeTransaction}
                    onChange={setActiveTransaction}
                  >
                    <JsonSchemaForm
                      schema={reportTemplate?.schema.transactionSchema}
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
                  reportTemplate.schema.indicators.map((i) => (
                    <Label label={i.description} position="RIGHT" level={1}>
                      <Checkbox
                        value={reportTemplate.parameters.indicators.indexOf(i.key) > -1}
                        onChange={handleIndicatorChange(i.key)}
                      />
                    </Label>
                  ))}
                {activeStepKey === FINALIZE_STEP && (
                  <>
                    <Button onClick={onSubmit}>Test Output</Button>
                    <div>{reportTemplate.output}</div>
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
