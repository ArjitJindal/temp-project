import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import NestedSelects, { RefType, Option as NestedSelectsOption } from './NestedSelects';
import SearchIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import { RuleEntityVariable, RuleEntityVariableInUse } from '@/apis';

// TODO: Move PropertyColumns to library
import Button from '@/components/library/Button';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';
import Select from '@/components/library/Select';
import { firstLetterUpper } from '@/utils/humanize';
import { useIsChanged } from '@/utils/hooks';

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
function oppositeVariableKey(variableKey: string): string | undefined {
  if (isTransactionOriginVariable(variableKey)) {
    return variableKey.replace('TRANSACTION:origin', 'TRANSACTION:destination');
  }
  if (isTransactionDestinationVariable(variableKey)) {
    return variableKey.replace('TRANSACTION:destination', 'TRANSACTION:origin');
  }
  if (isUserSenderVariable(variableKey)) {
    return variableKey.replace('__SENDER', '__RECEIVER');
  }
  if (isUserReceiverVariable(variableKey)) {
    return variableKey.replace('__RECEIVER', '__SENDER');
  }
  return undefined;
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
  const [searchKey, setSearchKey] = useState<string | undefined>();
  const handleUpdateForm = useCallback((newValues: Partial<FormRuleEntityVariable>) => {
    setFormValues((prevValues) => ({ ...prevValues, ...newValues }));
    if (!newValues.name || Object.keys(newValues).length > 1) {
      setSearchKey(undefined);
    }
  }, []);
  const allVariableOptions = useMemo(
    () =>
      entityVariables.map((v) => ({
        value: v.key,
        label: v.uiDefinition.label,
      })),
    [entityVariables],
  );

  const entityVariablesFiltered = useMemo(() => {
    return entityVariables.filter((v) => {
      if (entityVariablesInUse.find((e) => e.key === v.key && formValues.variableKey !== v.key)) {
        return false;
      }
      if (formValues.type === 'TRANSACTION') {
        const isOriginEnabled = formValues.transactionDirections?.includes('ORIGIN');
        const isDestinationEnabled = formValues.transactionDirections?.includes('DESTINATION');
        const isOriginVar = isTransactionOriginVariable(v.key);
        const isDestinationVar = isTransactionDestinationVariable(v.key);
        return (
          (isOriginEnabled && isOriginVar) ||
          (isDestinationEnabled && isDestinationVar) ||
          (!(isOriginVar || isDestinationVar) && v.entity === 'TRANSACTION')
        );
      } else if (formValues.type === 'USER') {
        const isSenderEnabled = formValues.userType === 'SENDER';
        const isReceiverEnabled = formValues.userType === 'RECEIVER';
        const isConsumerEnabled = formValues.userNatures?.includes('CONSUMER_USER');
        const isBusinessEnabled = formValues.userNatures?.includes('BUSINESS_USER');
        return (
          ((isSenderEnabled && isUserSenderVariable(v.key)) ||
            (isReceiverEnabled && isUserReceiverVariable(v.key))) &&
          ((isConsumerEnabled && v.entity === 'CONSUMER_USER') ||
            (isBusinessEnabled && v.entity === 'BUSINESS_USER') ||
            ((formValues.userNatures ?? []).length === 0 && v.entity === 'USER'))
        );
      }
    });
  }, [
    entityVariables,
    entityVariablesInUse,
    formValues.transactionDirections,
    formValues.type,
    formValues.userNatures,
    formValues.userType,
    formValues.variableKey,
  ]);

  // If variable is not available anymore - reset it and reset nested select
  const nestedSelectsRef = useRef<RefType>(null);
  const isVarAvailable = useMemo(() => {
    return entityVariablesFiltered.some((x) => x.key === formValues.variableKey);
  }, [entityVariablesFiltered, formValues.variableKey]);
  const isVarAvailableChanges = useIsChanged(isVarAvailable);
  useEffect(() => {
    const variableKey = formValues.variableKey;
    if (variableKey != null && !isVarAvailable && isVarAvailableChanges) {
      const keyToCheck = oppositeVariableKey(variableKey);
      const newVariableKey = entityVariablesFiltered.find((x) => x.key === keyToCheck)?.key;
      setFormValues((prevState) => ({ ...prevState, variableKey: newVariableKey }));
      nestedSelectsRef.current?.reset(newVariableKey);
    }
  }, [entityVariablesFiltered, formValues.variableKey, isVarAvailable, isVarAvailableChanges]);

  // If search key changed - reset nested selects
  const isSearchKeyChanged = useIsChanged(searchKey);
  useEffect(() => {
    const variableKey = formValues.variableKey;
    if (variableKey != null && isSearchKeyChanged) {
      nestedSelectsRef.current?.reset(variableKey);
    }
  }, [formValues.variableKey, isSearchKeyChanged]);

  const variableOptions = useMemo((): NestedSelectsOption[] => {
    type Tree = {
      children: { [key: string]: Tree };
      key: string;
    };
    const tree: Tree = {
      children: {},
      key: '',
    };
    for (const v of entityVariablesFiltered) {
      // "Transaction / origin payment details > bank address > postcode" ->
      // "origin payment details > bank address > postcode"
      const label = v.uiDefinition.label.split('/')[1].trim();

      // "origin payment details > bank address > postcode" ->
      // ["origin payment details", "bank address", "postcode"]
      const labelParts = label.split(/\s*?>+\s*/g);
      let nextTree = tree;
      for (const labelPart of labelParts) {
        const children = nextTree.children[labelPart] ?? {
          key: v.key,
          children: {},
        };
        nextTree.children[labelPart] = children;
        nextTree = children;
      }
    }

    function makeOptions(tree: Tree): NestedSelectsOption[] {
      return Object.entries(tree.children).map(([label, subtree]): NestedSelectsOption => {
        const children = makeOptions(subtree);
        return {
          value: children.length > 0 ? `INTERMEDIATE/${label}` : subtree.key,
          label: firstLetterUpper(label).replace(' (Receiver)', '').replace(' (Sender)', ''),
          children: makeOptions(subtree),
        };
      });
    }

    const options = makeOptions(tree);
    return options;
  }, [entityVariablesFiltered]);

  const entityVariable = entityVariables.find((v) => v.key === formValues.variableKey);

  return (
    <>
      <Card.Section direction="vertical">
        <Select<string | null>
          value={searchKey}
          onChange={(variableKey) => {
            setSearchKey(variableKey ?? undefined);
            if (variableKey) {
              setFormValues(getInitialFormValues({ key: variableKey }, entityVariables));
            }
          }}
          placeholder={
            <span>
              <SearchIcon style={{ width: 12, height: 12 }} />
              {'  '}Search for entity variable here or configure below
            </span>
          }
          portaled={true}
          mode="SINGLE"
          options={allVariableOptions}
          testId="variable-search-v8"
        />
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
            <Label label="Transaction direction">
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
          {variableOptions.length > 0 && (
            <NestedSelects
              testId="variable-entity-v8"
              ref={nestedSelectsRef}
              label="Entity"
              options={variableOptions}
              value={formValues.variableKey}
              onChange={(variableKey) => handleUpdateForm({ variableKey })}
            />
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
