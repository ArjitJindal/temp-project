import React, { useState } from 'react';
import { Card, Divider, Row, Steps } from 'antd';
import _ from 'lodash';
import { RulesTable } from './components';
import styles from './style.module.less';
import { RuleInstanceCreatedInfo } from './components/RuleInstanceCreatedInfo';
import { RuleConfigurationsEditor } from './components/RuleConfigurationsEditor';
import { Rule } from '@/apis';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';

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

  const i18n = useI18n();
  return (
    <PageWrapper
      title={i18n('menu.rules.create-rule')}
      description="Create a transaction monitoring rule with a straight-forward 3 step process"
    >
      <Card bordered={false}>
        <Row justify="center">
          <Steps current={current} className={styles.stepsContainer}>
            {STEPS.map((step, index) => (
              <Steps.Step key={index} title={step.title} description={step.description} />
            ))}
          </Steps>
        </Row>

        <Divider />

        {current === 0 ? (
          <RulesTable onSelectRule={handleSelectRule} />
        ) : current === 1 && selectedRule ? (
          <RuleConfigurationsEditor rule={selectedRule} onBack={prev} onActivated={next} />
        ) : (
          current === 2 &&
          selectedRule && (
            <RuleInstanceCreatedInfo rule={selectedRule} onFinish={async () => setCurrent(0)} />
          )
        )}
        <Divider style={{ margin: '40px 0 24px' }} />
        <div className={styles.desc}>
          <h3>Flagright Rules library</h3>
          <p>Choose exiting rules, customize parameters if needed</p>
          <h4>Can't find a rule you are looking for?</h4>
          <p>
            Use our 'Request a rule' form and we'll build a new rule template and add it to the
            library for you.
          </p>
        </div>
      </Card>
    </PageWrapper>
  );
};

export default StepForm;
