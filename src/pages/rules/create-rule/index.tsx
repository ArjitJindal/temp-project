import React, { useState } from 'react';
import { Card, Divider, Steps } from 'antd';
import { PageContainer } from '@ant-design/pro-layout';
import { RulesTable, RuleParametersEditor } from './components';
import styles from './style.less';
import { RuleInstanceCreatedInfo } from './components/RuleInstanceCreatedInfo';
import { Rule } from '@/apis';

const STEPS = [
  {
    title: 'Choose Rule',
    description: '',
  },
  {
    title: 'Customize Rule Parameters',
    description: '',
  },
  {
    title: 'Activate',
    description: '',
  },
];

const StepForm: React.FC<Record<string, any>> = () => {
  const [selectedRule, setSelectedRule] = useState<Rule>();
  const [current, setCurrent] = useState(0);
  const next = () => setCurrent(current + 1);
  const prev = () => setCurrent(current - 1);
  const handleSelectRule = (rule: Rule) => {
    setCurrent(current + 1);
    setSelectedRule(rule);
  };

  return (
    <PageContainer content="Create a transaction monitoring rule with a straight-forward 3 step process">
      <Card bordered={false}>
        <Steps current={current}>
          {STEPS.map((step, index) => (
            <Steps.Step key={index} title={step.title} description={step.description} />
          ))}
        </Steps>

        <div>
          {current === 0 ? (
            <RulesTable onSelectRule={handleSelectRule} />
          ) : current === 1 && selectedRule ? (
            <RuleParametersEditor rule={selectedRule} onBack={prev} onActivated={next} />
          ) : (
            current === 2 &&
            selectedRule && (
              <RuleInstanceCreatedInfo rule={selectedRule} onFinish={async () => setCurrent(0)} />
            )
          )}
        </div>
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
