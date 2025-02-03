import React, { useState } from 'react';
import VariableFilters from 'src/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/VariableFilters';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import {
  LogicEntityVariable,
  LogicEntityVariableInUse,
  RuleMachineLearningVariable,
  RuleType,
} from '@/apis';
import AggregationVariableSummary from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/AggregationVariableSummary';
import { FormRuleAggregationVariable } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/helpers';
import Label from '@/components/library/Label';
import Alert from '@/components/library/Alert';
import { getInitialFormValues } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/EntityVariableForm';
import { neverReturn } from '@/utils/lang';
import { AggregationVariableFormContent } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/AggregationVariableForm';

interface Props {
  ruleType: RuleType;
  onCancel: () => void;
  variable:
    | FormRuleAggregationVariable
    | LogicEntityVariableInUse
    | RuleMachineLearningVariable
    | undefined;
  entityVariables: LogicEntityVariable[];
}

export default function VariableInfoModal(props: Props) {
  const { onCancel, variable, entityVariables, ruleType } = props;
  let content: JSX.Element = <></>;
  let title = '';
  if (variable != null) {
    if ('entityKey' in variable) {
      content = (
        <EntityVariableInfo
          ruleType={ruleType}
          variable={variable}
          entityVariables={entityVariables}
        />
      );
      title = 'Entity variable information';
    } else if ('timeWindow' in variable) {
      content = (
        <AggregationVariableInfo
          ruleType={ruleType}
          variable={variable}
          entityVariables={entityVariables}
        />
      );
      title = 'Aggregation variable information';
    } else {
      content = <MachineLearningVariableInfo variable={variable} />;
      title = 'Machine learning variable information';
    }
  }
  return (
    <Modal
      title={title}
      isOpen={variable != null}
      onCancel={onCancel}
      hideOk={true}
      cancelText={'Close'}
      width={variable && 'timeWindow' in variable ? 'L' : 'M'}
    >
      <div className={s.root}>{content}</div>
    </Modal>
  );
}

function EntityVariableInfo(props: {
  ruleType: RuleType;
  variable: LogicEntityVariableInUse;
  entityVariables: LogicEntityVariable[];
}) {
  const { variable, ruleType, entityVariables } = props;
  const formValues = getInitialFormValues(ruleType, variable, entityVariables);

  const entityVariable = entityVariables.find((x) => x.key === variable?.entityKey);

  let label;
  if (entityVariable) {
    const [_, _entity, path, directions = ''] = entityVariable.uiDefinition.label.match(
      /^(?:(.+?)\s*\/\s*)?(.+?)(\s*\(.+\))?$/,
    );

    let entityTypeLabel;
    switch (entityVariable.entity) {
      case 'TRANSACTION':
        entityTypeLabel = 'transaction';
        break;
      case 'TRANSACTION_EVENT':
        entityTypeLabel = 'transaction event';
        break;
      case 'USER':
      case 'CONSUMER_USER':
      case 'BUSINESS_USER':
        entityTypeLabel = 'user';
        break;
      case 'PAYMENT_DETAILS':
        entityTypeLabel = 'payment details';
        break;
      case undefined:
        entityTypeLabel = undefined;
        break;
      default:
        entityTypeLabel = neverReturn(entityVariable.entity, undefined);
    }

    const pathParts = [
      ...(entityTypeLabel ? [entityTypeLabel + directions] : []),
      ...path.split(/\s*?>+\s*/g),
    ];

    pathParts.reverse();
    label = pathParts.map((part, i) => (
      <React.Fragment key={part}>
        {i !== 0 && ' of '}
        <b>{part}</b>
      </React.Fragment>
    ));
  }

  return (
    <>
      <Label label="Summary">
        <Alert type="INFO">
          {label != null ? (
            <>
              {'This variable uses value of '}
              {label}
            </>
          ) : (
            <b>N/A</b>
          )}
        </Alert>
      </Label>
      <Label label="Filters">
        <Alert type="INFO">
          The system will search from the latest to the earliest{' '}
          {formValues.type?.toLowerCase() ?? 'unknown'} event to find the first match based on your
          filters
        </Alert>
        <VariableFilters
          formValuesState={[variable, () => {}]}
          ruleType={ruleType}
          readOnly={true}
        />
      </Label>
    </>
  );
}

function AggregationVariableInfo(props: {
  ruleType: RuleType;
  variable: FormRuleAggregationVariable;
  entityVariables: LogicEntityVariable[];
}) {
  const { ruleType, variable, entityVariables } = props;
  const [showConfiguration, setShowConfiguration] = useState(false);
  return (
    <>
      <Label label="Variable summary">
        <Alert type="INFO">
          <AggregationVariableSummary
            ruleType={ruleType}
            variableFormValues={variable}
            entityVariables={entityVariables}
          />
        </Alert>
      </Label>
      <Label label="Filters">
        <VariableFilters
          formValuesState={[variable, () => {}]}
          ruleType={ruleType}
          readOnly={true}
        />
      </Label>
      {!showConfiguration ? (
        <a
          href={'#'}
          onClick={() => {
            setShowConfiguration(true);
          }}
        >
          Show full variable configuration
        </a>
      ) : (
        <AggregationVariableFormContent
          formValuesState={[variable, () => {}]}
          ruleType={'USER'}
          entityVariables={entityVariables}
          readOnly={true}
          hideFilters={true}
          hideSummary={true}
        />
      )}
    </>
  );
}

function MachineLearningVariableInfo(props: { variable: RuleMachineLearningVariable }) {
  const { variable } = props;
  return (
    <div>
      <Label label="Variable name">{variable.name}</Label>
      <Label label="ML model">{variable.key}</Label>
    </div>
  );
}
