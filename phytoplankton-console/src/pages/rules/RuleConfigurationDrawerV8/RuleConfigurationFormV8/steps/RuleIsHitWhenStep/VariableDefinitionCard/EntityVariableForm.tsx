import React, { useCallback, useMemo, useState } from 'react';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import { RuleEntityVariable, RuleEntityVariableInUse } from '@/apis';

// TODO: Move PropertyColumns to library
import Button from '@/components/library/Button';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';
import Select from '@/components/library/Select';

type FormRuleEntityVariable = {
  type?: 'TRANSACTION' | 'USER';
  name?: string;
  transactionDirections?: Array<'ORIGIN' | 'DESTINATION'>;
  userType?: 'SENDER' | 'RECEIVER';
  userNatures?: Array<'CONSUMER_USER' | 'BUSINESS_USER'>;
  variableKey?: string;
};

interface EntityVariableFormProps {
  variable: RuleEntityVariableInUse | undefined;
  entityVariables: RuleEntityVariable[];
  entityVariablesInUse: RuleEntityVariableInUse[];
  isNew: boolean;
  onUpdate: (newEntityVariable: RuleEntityVariableInUse) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS: Array<{ value: 'TRANSACTION' | 'USER'; label: string }> = [
  { value: 'TRANSACTION', label: 'Transaction' },
  { value: 'USER', label: 'User' },
];
const TX_DIRECTION_OPTIONS: Array<{ value: 'ORIGIN' | 'DESTINATION'; label: string }> = [
  { value: 'ORIGIN', label: 'Origin' },
  { value: 'DESTINATION', label: 'Destination' },
];
const USER_TYPE_OPTIONS: Array<{ value: 'SENDER' | 'RECEIVER'; label: string }> = [
  { value: 'SENDER', label: 'Sender' },
  { value: 'RECEIVER', label: 'Receiver' },
];
const USER_NATURE_OPTIONS: Array<{ value: 'CONSUMER_USER' | 'BUSINESS_USER'; label: string }> = [
  { value: 'CONSUMER_USER', label: 'Consumer' },
  { value: 'BUSINESS_USER', label: 'Business' },
];

function getInitialFormValues(
  variable: RuleEntityVariableInUse | undefined,
  entityVariables: RuleEntityVariable[],
): FormRuleEntityVariable {
  const entityVariable = entityVariables.find((v) => v.key === variable?.key);
  if (!entityVariable) {
    return {};
  }
  const result: FormRuleEntityVariable = {
    name: variable?.name,
    variableKey: entityVariable.key,
  };
  if (entityVariable.entity === 'TRANSACTION') {
    result.type = 'TRANSACTION';
    result.transactionDirections = entityVariable.key.startsWith('TRANSACTION:origin')
      ? ['ORIGIN']
      : entityVariable.key.startsWith('TRANSACTION:destination')
      ? ['DESTINATION']
      : undefined;
  } else {
    result.type = 'USER';
    result.userType = isUserSenderVariable(entityVariable.key)
      ? 'SENDER'
      : isUserReceiverVariable(entityVariable.key)
      ? 'RECEIVER'
      : undefined;
    result.userNatures =
      entityVariable.entity === 'CONSUMER_USER'
        ? ['CONSUMER_USER']
        : entityVariable.entity === 'BUSINESS_USER'
        ? ['BUSINESS_USER']
        : undefined;
  }
  return result;
}

function isTransactionOriginVariable(variableKey: string) {
  return variableKey.startsWith('TRANSACTION:origin');
}
function isTransactionDestinationVariable(variableKey: string) {
  return variableKey.startsWith('TRANSACTION:destination');
}
function isUserSenderVariable(variableKey: string) {
  return variableKey.endsWith('__SENDER');
}
function isUserReceiverVariable(variableKey: string) {
  return variableKey.endsWith('__RECEIVER');
}

export const EntityVariableForm: React.FC<EntityVariableFormProps> = ({
  variable,
  entityVariables,
  entityVariablesInUse,
  isNew,
  onUpdate,
  onCancel,
}) => {
  const [formValues, setFormValues] = useState<FormRuleEntityVariable>(
    getInitialFormValues(variable, entityVariables),
  );
  const handleUpdateForm = useCallback((newValues: Partial<FormRuleEntityVariable>) => {
    if (
      newValues.type ||
      newValues.transactionDirections ||
      newValues.userType ||
      newValues.userNatures
    ) {
      newValues.variableKey = undefined;
    }
    setFormValues((prevValues) => ({ ...prevValues, ...newValues }));
  }, []);
  const variableOptions = useMemo(
    () =>
      entityVariables
        .filter((v) => {
          if (
            entityVariablesInUse.find((e) => e.key === v.key && formValues.variableKey !== v.key)
          ) {
            return false;
          }
          if (formValues.type === 'TRANSACTION') {
            return (
              (formValues.transactionDirections?.includes('ORIGIN') &&
                isTransactionOriginVariable(v.key)) ||
              (formValues.transactionDirections?.includes('DESTINATION') &&
                isTransactionDestinationVariable(v.key)) ||
              ((formValues.transactionDirections ?? []).length === 0 &&
                v.entity === 'TRANSACTION' &&
                !isTransactionOriginVariable(v.key) &&
                !isTransactionDestinationVariable(v.key))
            );
          } else if (formValues.type === 'USER') {
            return (
              ((formValues.userType === 'SENDER' && isUserSenderVariable(v.key)) ||
                (formValues.userType === 'RECEIVER' && isUserReceiverVariable(v.key))) &&
              ((formValues.userNatures?.includes('CONSUMER_USER') &&
                v.entity === 'CONSUMER_USER') ||
                (formValues.userNatures?.includes('BUSINESS_USER') &&
                  v.entity === 'BUSINESS_USER') ||
                ((formValues.userNatures ?? []).length === 0 && v.entity === 'USER'))
            );
          }
        })
        .map((v) => ({
          value: v.key,
          label: v.uiDefinition.label,
        })),
    [
      entityVariables,
      entityVariablesInUse,
      formValues.transactionDirections,
      formValues.type,
      formValues.userNatures,
      formValues.userType,
      formValues.variableKey,
    ],
  );
  const entityVariable = entityVariables.find((v) => v.key === formValues.variableKey);
  return (
    <>
      <Card.Section direction="vertical">
        <Label label="Variable name" required={{ value: false, showHint: true }}>
          <TextInput
            value={formValues.name}
            onChange={(name) => handleUpdateForm({ name })}
            placeholder={entityVariable?.uiDefinition.label || 'Custom variable name'}
            allowClear
            testName="variable-name-v8"
          />
        </Label>
        <PropertyColumns>
          <Label label="Variable type" required={{ value: true, showHint: true }}>
            <SelectionGroup
              value={formValues.type}
              onChange={(type) => handleUpdateForm({ type })}
              mode={'SINGLE'}
              options={TYPE_OPTIONS}
              testName="variable-type-v8"
            />
          </Label>
          {formValues.type === 'TRANSACTION' && (
            <Label label="Transaction direction" required={{ value: false, showHint: true }}>
              <SelectionGroup
                value={formValues.transactionDirections}
                onChange={(transactionDirections) => handleUpdateForm({ transactionDirections })}
                mode={'MULTIPLE'}
                options={TX_DIRECTION_OPTIONS}
                testName="variable-tx-direction-v8"
              />
            </Label>
          )}
          {formValues.type === 'USER' && (
            <>
              <Label label="User type" required={{ value: true, showHint: true }}>
                <SelectionGroup
                  value={formValues.userType}
                  onChange={(userType) => handleUpdateForm({ userType })}
                  mode={'SINGLE'}
                  options={USER_TYPE_OPTIONS}
                  testName="variable-user-type-v8"
                />
              </Label>
              <Label label="User nature" required={{ value: false, showHint: true }}>
                <SelectionGroup
                  value={formValues.userNatures}
                  onChange={(userNatures) => handleUpdateForm({ userNatures })}
                  mode={'MULTIPLE'}
                  options={USER_NATURE_OPTIONS}
                  testName="variable-user-nature-v8"
                />
              </Label>
            </>
          )}

          {formValues.type && (
            <Label
              label="Entity"
              required={{ value: true, showHint: true }}
              testId="variable-entity-v8"
            >
              <Select<string>
                value={formValues.variableKey}
                onChange={(variableKey) => handleUpdateForm({ variableKey })}
                mode="SINGLE"
                options={variableOptions}
              />
            </Label>
          )}
        </PropertyColumns>
      </Card.Section>
      <Card.Section direction="horizontal">
        <Button
          type="PRIMARY"
          onClick={() => {
            if (formValues.variableKey) {
              onUpdate({ key: formValues.variableKey, name: formValues.name });
            }
          }}
          isDisabled={!formValues.variableKey}
          testName={`${isNew ? 'add' : 'update'}-variable-v8`}
        >
          {isNew ? 'Add' : 'Update'}
        </Button>
        <Button type="SECONDARY" onClick={onCancel}>
          Cancel
        </Button>
      </Card.Section>
    </>
  );
};
