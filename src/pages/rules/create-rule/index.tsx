import React, { Dispatch, SetStateAction, useRef, useState } from 'react';
import { FormInstance, Radio } from 'antd';
import { Card, Result, Button, Descriptions, Divider, Alert } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import { StepsForm } from '@ant-design/pro-form';
import type { StepDataType, ThresholdUpdateDataSourceType } from './data.d';
import type { RuleAction, ThresholdAllowedDataTypes } from '../data.d';
import { RulesTableSearch, ThresholdUpdateTable } from './components';
import styles from './style.less';

const ruleActionOptions = [
  { label: 'Flag', value: 'flag' },
  { label: 'Block', value: 'block' },
  { label: 'Allow', value: 'allow' },
];

const StepDescriptions: React.FC<{
  stepData: StepDataType;
  bordered?: boolean;
}> = ({ stepData, bordered }) => {
  const { name, ruleId, ruleDescription } = stepData;

  return (
    <Descriptions column={1} bordered={bordered}>
      <Descriptions.Item label="Rule Name"> {name}</Descriptions.Item>
      <Descriptions.Item label="Rule Template ID"> {ruleId}</Descriptions.Item>
      <Descriptions.Item label="Rule Description"> {ruleDescription}</Descriptions.Item>
    </Descriptions>
  );
};

const StepRuleAction: React.FC<{
  stepData: StepDataType;
  ruleAction: RuleAction;
  setRuleAction: Dispatch<SetStateAction<RuleAction>>;
  bordered?: boolean;
}> = ({ stepData, ruleAction, setRuleAction, bordered }) => {
  return (
    <>
      <h3>Rule Action: </h3>

      <Radio.Group
        options={ruleActionOptions}
        onChange={(e) => {
          setRuleAction(e.target.value);
        }}
        value={ruleAction}
        defaultValue={stepData.ruleAction}
        optionType="button"
        buttonStyle="solid"
        style={{ margin: '0px auto', width: '100%', textAlign: 'center' }}
        size="large"
      />
    </>
  );
};

const StepResult: React.FC<{
  onFinish: () => Promise<void>;
}> = (props) => {
  return (
    <Result
      status="success"
      title="Rule Successfully created"
      subTitle="All new transactions will go through this rule"
      extra={
        <>
          <Button type="primary" onClick={props.onFinish}>
            Create another rule
          </Button>
          <Button href="/rules/created-rules">Go to Created rules</Button>
        </>
      }
      className={styles.result}
    >
      {props.children}
    </Result>
  );
};

const StepForm: React.FC<Record<string, any>> = () => {
  // lol is this even the right way of doing this. I bet not. Fix it later
  const [stepData, setStepData] = useState<StepDataType>({
    name: 'Proof of funds',
    ruleId: 'R-1',
    ruleDescription:
      'If a user makes a remittance transaction >= x in EUR for a given risk level, flag user & transactions and ask for proof of funds.',
    ruleAction: 'flag',
    thresholdData: [
      {
        parameter: 'test',
        type: 'string' as ThresholdAllowedDataTypes,
        defaultValue: 'test',
      },
    ],
  });

  const [ruleAction, setRuleAction] = useState<RuleAction>(stepData.ruleAction);
  const [current, setCurrent] = useState(0);
  const formRef = useRef<FormInstance>();

  const processedData: ThresholdUpdateDataSourceType[] = [
    {
      id: 'default',
      parameter: 'country',
      defaultValue: 'AF',
    },
  ];

  const [dataSource, setDataSource] = useState<ThresholdUpdateDataSourceType[]>(
    () => processedData,
  );

  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>(() =>
    dataSource.map((item) => item.id),
  );

  return (
    <PageContainer content="Create a transaction monitoring rule with a staright-forward 3 step process">
      <Card bordered={false}>
        <StepsForm
          containerStyle={{ width: '100%' }}
          current={current}
          onCurrentChange={setCurrent}
          submitter={{
            render: (props, dom) => {
              if (props.step === 2) {
                return null;
              }
              return dom;
            },
          }}
        >
          <StepsForm.StepForm<StepDataType>
            formRef={formRef}
            title="Choose Rule"
            initialValues={stepData}
          >
            <RulesTableSearch
              setStepData={setStepData}
              setRuleAction={setRuleAction}
              setDataSource={setDataSource}
              setEditableRowKeys={setEditableRowKeys}
            />
          </StepsForm.StepForm>

          <StepsForm.StepForm title="Set the threshold">
            <>
              <div className={styles.result}>
                <Alert
                  closable
                  showIcon
                  message="Thresholds are set to default values, update them to match your risk appetite"
                  style={{ marginBottom: 24 }}
                />
                <StepDescriptions stepData={stepData} bordered />
              </div>
              <div className={styles.thresholdUpdateWrapper}>
                <Divider style={{ margin: '18px 0' }} />
                <ThresholdUpdateTable
                  editableKeys={editableKeys}
                  setEditableRowKeys={setEditableRowKeys}
                  dataSource={dataSource}
                  setDataSource={setDataSource}
                />
                <Divider style={{ margin: '15px 0' }} />
                <div className={styles.ruleActionSelector}>
                  <StepRuleAction
                    stepData={stepData}
                    ruleAction={ruleAction}
                    setRuleAction={setRuleAction}
                  />
                </div>
                <Divider style={{ margin: '18px 0' }} />
              </div>
            </>
          </StepsForm.StepForm>
          <StepsForm.StepForm title="Activate">
            <StepResult
              onFinish={async () => {
                setCurrent(0);
                formRef.current?.resetFields();
              }}
            >
              <StepDescriptions stepData={stepData} />
            </StepResult>
          </StepsForm.StepForm>
        </StepsForm>
        <Divider style={{ margin: '40px 0 24px' }} />
        <div className={styles.desc}>
          <h3>Flagright Rules library</h3>
          <p>Choose exiting rules, update thresholds if needed</p>
          <h4>Can't find a rule you are looking for?</h4>
          <p>
            Use our 'Request a rule' form and we'll build a new rule template and add it to the
            library for you.
          </p>
        </div>
      </Card>
    </PageContainer>
  );
};

export default StepForm;
