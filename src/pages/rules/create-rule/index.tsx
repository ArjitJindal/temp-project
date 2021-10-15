import React, { useRef, useState } from 'react';
import type { FormInstance } from 'antd';
import { Card, Result, Button, Descriptions, Divider, Alert } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import ProForm, { ProFormSelect, ProFormText, StepsForm } from '@ant-design/pro-form';
import type { StepDataType } from './data';
import { RulesTableSearch } from './components/RulesTableSearch';
import styles from './style.less';

const StepDescriptions: React.FC<{
  stepData: StepDataType;
  bordered?: boolean;
}> = ({ stepData, bordered }) => {
  const { name, ruleId, ruleDescription } = stepData;
  console.log(stepData);

  return (
    <Descriptions column={1} bordered={bordered}>
      <Descriptions.Item label="Rule Name"> {name}</Descriptions.Item>
      <Descriptions.Item label="Rule ID"> {ruleId}</Descriptions.Item>
      <Descriptions.Item label="Rule Description"> {ruleDescription}</Descriptions.Item>
    </Descriptions>
  );
};

const StepResult: React.FC<{
  onFinish: () => Promise<void>;
}> = (props) => {
  return (
    <Result
      status="success"
      title="操作成功"
      subTitle="预计两小时内到账"
      extra={
        <>
          <Button type="primary" onClick={props.onFinish}>
            再转一笔
          </Button>
          <Button>查看账单</Button>
        </>
      }
      className={styles.result}
    >
      {props.children}
    </Result>
  );
};

const StepForm: React.FC<Record<string, any>> = () => {
  const [stepData, setStepData] = useState<StepDataType>({
    payAccount: 'ant-design@alipay.com',
    receiverAccount: 'test@example.com',
    receiverName: 'Alex2',
    receiverMode: 'alipay',
    name: 'Proof of funds',
    ruleId: 'R-1',
    ruleDescription:
      'If a user makes a remittance transaction >= x in EUR for a given risk level, flag user & transactions and ask for proof of funds.',
  });
  const [current, setCurrent] = useState(0);
  const formRef = useRef<FormInstance>();

  return (
    <PageContainer content="Create a transaction monitoring rule with a staright forward 3 step process">
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
            <RulesTableSearch setStepData={setStepData} />
          </StepsForm.StepForm>

          <StepsForm.StepForm title="Set the threshold">
            <div className={styles.result}>
              <Alert
                closable
                showIcon
                message="Thresholds are set to default values, update them to match your risk appetite"
                style={{ marginBottom: 24 }}
              />
              <StepDescriptions stepData={stepData} bordered />
              <Divider style={{ margin: '24px 0' }} />
            </div>
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
          <h4>转账到支付宝账户</h4>
          <p>
            如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。
          </p>
          <h4>转账到银行卡</h4>
          <p>
            如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。如果需要，这里可以放一些关于产品的常见问题说明。
          </p>
        </div>
      </Card>
    </PageContainer>
  );
};

export default StepForm;
