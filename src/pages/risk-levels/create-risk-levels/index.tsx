import React, { useRef, useState } from 'react';
import { FormInstance } from 'antd';
import { Card, Result, Button, Descriptions, Divider, Alert } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import { StepsForm } from '@ant-design/pro-form';
import type { StepDataType, RiskScoreDataSourceType } from './data.d';
import { RiskScoreParametersTableSearch, RiskScoreUpdateTable } from './components';
import styles from './style.less';

const StepDescriptions: React.FC<{
  stepData: StepDataType;
  bordered?: boolean;
}> = ({ stepData, bordered }) => {
  const { name, parameterDescription } = stepData;

  return (
    <Descriptions column={1} bordered={bordered}>
      <Descriptions.Item label="Parameter Name"> {name}</Descriptions.Item>
      <Descriptions.Item label="Parameter Description"> {parameterDescription}</Descriptions.Item>
    </Descriptions>
  );
};

const StepResult: React.FC<{
  onFinish: () => Promise<void>;
}> = (props) => {
  return (
    <Result
      status="success"
      title="Risk Scoring updated"
      subTitle="Risk level calculation will now use the newly created parameter risk score"
      extra={
        <>
          <Button type="primary" onClick={props.onFinish}>
            Activate New Risk Parameter
          </Button>
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
    parameterId: 'R-1',
    parameterDescription:
      'If a user makes a remittance transaction >= x in EUR for a given risk level, flag user & transactions and ask for proof of funds.',
    parameterType: 'range',
  });

  const [current, setCurrent] = useState(0);
  const formRef = useRef<FormInstance>();

  const processedData: RiskScoreDataSourceType[] = [
    {
      id: 'default',
      parameter: 'country',
      defaultValue: 'AF',
    },
  ];

  const [dataSource, setDataSource] = useState<RiskScoreDataSourceType[]>(() => processedData);

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
            title="Choose Parameter"
            initialValues={stepData}
          >
            <RiskScoreParametersTableSearch
              setStepData={setStepData}
              setDataSource={setDataSource}
              setEditableRowKeys={setEditableRowKeys}
            />
          </StepsForm.StepForm>

          <StepsForm.StepForm title="Set the risk scores">
            <>
              <div className={styles.result}>
                <Alert
                  closable
                  showIcon
                  message="Risk scores are set to default values, update them to match your risk appetite"
                  style={{ marginBottom: 24 }}
                />
                <StepDescriptions stepData={stepData} bordered />
              </div>
              <div className={styles.thresholdUpdateWrapper}>
                <Divider style={{ margin: '18px 0' }} />
                <RiskScoreUpdateTable
                  editableKeys={editableKeys}
                  setEditableRowKeys={setEditableRowKeys}
                  dataSource={dataSource}
                  setDataSource={setDataSource}
                />
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
