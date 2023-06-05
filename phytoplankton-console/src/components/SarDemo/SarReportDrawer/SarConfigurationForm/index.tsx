import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeneralDetailsStep } from '../steps/GeneralDetailsStep';
import { TransactionDetailsStep } from '../steps/TransactionDetailsStep';
import { IndicatorsStep } from '../steps/IndicatorsStep';
import { AttachmentsStep } from '../steps/AttachmentsStep';
import s from './style.module.less';
import Stepper from '@/components/library/Stepper';
import VerticalMenu from '@/components/library/VerticalMenu';
import Form from '@/components/library/Form';
import NestedForm from '@/components/library/Form/NestedForm';
import { ChangeJsonSchemaEditorSettings } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/settings';
import { usePrevious } from '@/utils/hooks';
import { dayjs } from '@/utils/dayjs';

const GENERAL_DETAILS_STEP = '1';
const TRANSACTION_DETAILS_STEP = '2';
const INDICATORS_STEP = '3';
const ATTACHMENTS_STEP = '4';

export const SAR_CONFIGURATION_STEPS = [
  GENERAL_DETAILS_STEP,
  TRANSACTION_DETAILS_STEP,
  INDICATORS_STEP,
  ATTACHMENTS_STEP,
];

interface RuleConfigurationFormProps {
  activeStepKey?: string;
  transactionIds: string[];
  onActiveStepKeyChange: (key: string) => void;
  onSubmit: (formValues: any) => void;
}

export function SarConfigurationForm(props: RuleConfigurationFormProps) {
  const { transactionIds, onActiveStepKeyChange } = props;
  const initialValues = {
    generalDetailsStep: {
      entityName: 'Flagright Data Technologies Inc.',
      entityReference: '2385895939839',
      entityBranch: 'Germany, DE',
      addressType: 'Business',
      zipCode: '10625',
      city: 'Berlin',
      country: 'Germany',
      firstName: 'Baran',
      lastName: 'Ozkan',
      ssn: '378348983929002',
      idType: 'Passport',
      idNumber: '378348983929002',
    },
    transactionDetailsStep: {
      transactionId: transactionIds[0],
      transactionLocation: 'Germany',
      transactionAmount: 'USD 30993.23',
      transactionDate: dayjs('2023-05-02'),
      internalReferenceNumber: '3278292',
      transactionMode: 'Electronic mode',
      transactionSenderPersonFirstName: 'Gavin',
      transactionSenderPersonLastName: 'Nelson',
      transactionSenderPersonGener: 'Male',
      transactionSenderPersonBirthDate: dayjs('1980-04-02'),
      transactionSenderPersonBirthPlace: 'San Francisco',
      transactionSenderPhoneContactType: 'Mobile',
      transactionSenderPhoneCountryPrefix: '+',
      transactionSenderPhoneNumber: '(555) 555-1234',
      transactionSenderAddressZipCode: '24219',
      transactionSenderAddressCity: 'Big Stone Gap',
      transactionSenderAddressAddress: '577 Douglas Dairy Road',
      transactionSenderAddressCountry: 'United States',
      transactionReceiverEntityName: 'Golden Gate Holdings, LLC',
      transactionReceiverEntityLegalForm: 'AG',
      transactionReceiverEntityRegisterNumber: 'ED3K325A',
      transactionReceiverEntityBusiness: 'Innovatek',
      transactionReceiverEntityCountry: 'RU',
    },
  };
  const [activeTabKey, setActiveTabKey] = useState('report_details');
  const STEPS = useMemo(
    () => [
      {
        key: GENERAL_DETAILS_STEP,
        title: 'General details',
        description: 'Enter reporting entity, person and report details',
        tabs: [
          { key: 'report_details', title: 'Report details' },
          { key: 'report_entity_details', title: 'Reporting entity details' },
          { key: 'report_person_details', title: 'Reporting person details' },
        ],
      },
      {
        key: TRANSACTION_DETAILS_STEP,
        title: 'Transaction details',
        description: 'Enter details of transactions that you want to report',
        tabs: transactionIds.map((transactionId) => ({ key: transactionId, title: transactionId })),
      },
      {
        key: INDICATORS_STEP,
        title: 'Indicators',
        description: 'Select one or more indicators that are relevant to your report',
        tabs: [],
      },
      {
        key: ATTACHMENTS_STEP,
        title: 'Attachments',
        description: 'Upload any supporting documents for your report',
        tabs: [],
      },
    ],
    [transactionIds],
  );
  const prevActiveStepKey = usePrevious(props.activeStepKey);
  useEffect(() => {
    if (prevActiveStepKey !== props.activeStepKey) {
      setActiveTabKey(STEPS.find(({ key }) => key === props.activeStepKey)?.tabs[0]?.key || '');
    }
  }, [STEPS, activeTabKey, prevActiveStepKey, props.activeStepKey]);

  const formRef = useRef<any>(null);
  const handleUpdateReportReason = useCallback((reason: string) => {
    const formValues = formRef.current.getValues();
    formValues.generalDetailsStep.reportReason = reason;
    formRef.current.setValues(formValues);
  }, []);
  const handleChangeSenderReceiverType = useCallback(() => {
    const formValues = formRef.current.getValues();
    formValues.transactionDetailsStep = Object.fromEntries(
      Object.entries(formValues.transactionDetailsStep).map((entry) => {
        if (entry[0].includes('Sender') || entry[0].includes('Receiver')) {
          return [entry[0], undefined];
        }
        return entry;
      }),
    );
    formRef.current.setValues(formValues);
  }, []);

  return (
    <Form<any> initialValues={initialValues} ref={formRef}>
      <Stepper
        className={s.stepper}
        steps={STEPS}
        active={props.activeStepKey!}
        onChange={onActiveStepKeyChange}
      >
        {(activeStepKey) => {
          const activeStep = STEPS.find(({ key }) => key === activeStepKey);
          const items = activeStep?.tabs ?? [];
          return items.length > 0 ? (
            <VerticalMenu
              items={items}
              active={activeTabKey}
              onChange={setActiveTabKey}
              minWidth={200}
            >
              <div className={s.scrollContainer}>
                <div className={s.tabContent}>
                  <ChangeJsonSchemaEditorSettings>
                    {activeStepKey === GENERAL_DETAILS_STEP && (
                      <div>
                        <NestedForm<any> name={'generalDetailsStep'}>
                          <GeneralDetailsStep
                            activeTab={activeTabKey}
                            targetPersonName={`${initialValues.transactionDetailsStep.transactionSenderPersonFirstName} ${initialValues.transactionDetailsStep.transactionSenderPersonLastName}`}
                            onUpdateReportReason={handleUpdateReportReason}
                          />
                        </NestedForm>
                      </div>
                    )}
                    {activeStepKey === TRANSACTION_DETAILS_STEP && (
                      <div>
                        <NestedForm<any> name={'transactionDetailsStep'}>
                          <TransactionDetailsStep
                            activeTab={activeTabKey}
                            onChangeSenderType={handleChangeSenderReceiverType}
                            onChangeReceiverType={handleChangeSenderReceiverType}
                          />
                        </NestedForm>
                      </div>
                    )}
                  </ChangeJsonSchemaEditorSettings>
                </div>
              </div>
            </VerticalMenu>
          ) : (
            <>
              {activeStepKey === INDICATORS_STEP && (
                <div>
                  <NestedForm<any> name={'indicatorsStep'}>
                    <IndicatorsStep />
                  </NestedForm>
                </div>
              )}
              {activeStepKey === ATTACHMENTS_STEP && (
                <div>
                  <NestedForm<any> name={'attachmentsStep'}>
                    <AttachmentsStep />
                  </NestedForm>
                </div>
              )}
            </>
          );
        }}
      </Stepper>
    </Form>
  );
}
