import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shortId } from '@flagright/lib/utils';
import { Link } from 'react-router-dom';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import {
  isDirectionlessVariable,
  isTransactionDestinationVariable,
  isTransactionOriginOrDestinationVariable,
  isTransactionOriginVariable,
  isUserReceiverVariable,
  isUserSenderOrReceiverVariable,
  isUserSenderVariable,
} from '../helpers';
import NestedSelects, { Option as NestedSelectsOption, RefType } from './NestedSelects';
import VariableFilters from './VariableFilters';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import {
  LogicEntityVariable,
  LogicEntityVariableEntityEnum,
  LogicEntityVariableInUse,
  RuleType,
} from '@/apis';
// TODO: Move PropertyColumns to library
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';
import { useIsChanged } from '@/utils/hooks';
import Modal from '@/components/library/Modal';
import Alert from '@/components/library/Alert';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { FilterProps } from '@/components/library/Filter/types';
import { RuleUniversalSearchFilters } from '@/pages/rules/RulesTable/RulesSearchBar';
import { success } from '@/utils/asyncResource';
import SearchBar from '@/components/library/SearchBar';

type UserType = 'SENDER' | 'RECEIVER' | 'BOTH';
type TransactionDirection = 'ORIGIN' | 'DESTINATION' | 'BOTH';

type FormRuleEntityVariable = {
  type?: 'TRANSACTION' | 'USER';
  name?: string;
  transactionDirection?: TransactionDirection;
  userType?: UserType;
  userNatures?: Array<'CONSUMER_USER' | 'BUSINESS_USER'>;
  variableKey?: string;
  entityVariableKey?: string;
  filtersLogic?: any;
};

interface EntityVariableFormProps {
  ruleType: RuleType;
  variable: LogicEntityVariableInUse | undefined;
  entityVariables: LogicEntityVariable[];
  entityVariablesInUse: LogicEntityVariableInUse[];
  isNew: boolean;
  readOnly?: boolean;
  onUpdate: (newEntityVariable: LogicEntityVariableInUse) => void;
  onCancel: () => void;
  entity?: LogicEntityVariableEntityEnum;
}

const TX_DIRECTION_OPTIONS: Array<{ value: TransactionDirection; label: string }> = [
  { value: 'ORIGIN', label: 'Origin' },
  { value: 'DESTINATION', label: 'Destination' },
  { value: 'BOTH', label: 'Both' },
];
const USER_TYPE_OPTIONS: Array<{ value: UserType; label: string }> = [
  { value: 'SENDER', label: 'Sender' },
  { value: 'RECEIVER', label: 'Receiver' },
  { value: 'BOTH', label: 'Both' },
];
const USER_NATURE_OPTIONS: Array<{ value: 'CONSUMER_USER' | 'BUSINESS_USER'; label: string }> = [
  { value: 'CONSUMER_USER', label: 'Consumer' },
  { value: 'BUSINESS_USER', label: 'Business' },
];

export function getNewEntityVariableKey() {
  return `entity:${shortId()}`;
}

export function getInitialFormValues(
  ruleType: RuleType,
  variable: LogicEntityVariableInUse | undefined,
  entityVariables: LogicEntityVariable[],
  variableType?: 'TRANSACTION' | 'USER',
): FormRuleEntityVariable {
  const entityVariable = entityVariables.find((v) => v.key === variable?.entityKey);
  if (!entityVariable) {
    if (variableType === 'USER') {
      return { type: 'USER', userType: 'BOTH' };
    }
    if (ruleType === 'TRANSACTION' || variableType === 'TRANSACTION') {
      return { type: 'TRANSACTION' };
    }
    return { type: 'USER', userType: 'BOTH' };
  }
  const result: FormRuleEntityVariable = {
    name: variable?.name,
    variableKey: variable?.key,
    entityVariableKey: entityVariable.key,
    filtersLogic: variable?.filtersLogic,
  };
  if (entityVariable.entity === 'TRANSACTION' || entityVariable.entity === 'TRANSACTION_EVENT') {
    result.type = 'TRANSACTION';
    result.transactionDirection = entityVariable.key.startsWith('TRANSACTION:origin')
      ? 'ORIGIN'
      : entityVariable.key.startsWith('TRANSACTION:destination')
      ? 'DESTINATION'
      : undefined;
  } else {
    result.type = 'USER';
    result.userType = isUserSenderVariable(entityVariable.key)
      ? 'SENDER'
      : isUserReceiverVariable(entityVariable.key)
      ? 'RECEIVER'
      : isUserSenderOrReceiverVariable(entityVariable.key)
      ? 'BOTH'
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

function getFilterEntityVariableTypes(
  entityVariable?: LogicEntityVariable,
): LogicEntityVariableEntityEnum[] {
  if (entityVariable?.entity === 'TRANSACTION' || entityVariable?.entity === 'TRANSACTION_EVENT') {
    return ['TRANSACTION', 'TRANSACTION_EVENT'];
  }
  if (entityVariable?.entity === 'USER') {
    return ['USER', 'CONSUMER_USER', 'BUSINESS_USER'];
  }
  if (entityVariable?.entity === 'CONSUMER_USER') {
    return ['CONSUMER_USER'];
  }
  if (entityVariable?.entity === 'BUSINESS_USER') {
    return ['BUSINESS_USER'];
  }
  return [];
}

export const EntityVariableForm: React.FC<EntityVariableFormProps> = ({
  ruleType,
  variable,
  entityVariables,
  isNew,
  readOnly,
  onUpdate,
  onCancel,
  entity,
}) => {
  const [formValues, setFormValues] = useState<FormRuleEntityVariable>(
    getInitialFormValues(ruleType, variable, entityVariables),
  );
  const settings = useSettings();

  const TX_ENTITY_TYPE_OPTIONS: Array<{
    value: 'TRANSACTION' | 'USER';
    label: string;
    isDisabled?: boolean;
  }> = [
    { value: 'TRANSACTION', label: 'Transaction' },
    { value: 'USER', label: firstLetterUpper(settings.userAlias) },
  ];

  const ALL_TX_ENTITY_TYPE_OPTIONS: Array<{
    value: 'TRANSACTION' | 'CONSUMER_USER' | 'BUSINESS_USER';
    label: string;
    isDisabled?: boolean;
  }> = [
    { value: 'TRANSACTION', label: 'Transaction' },
    { value: 'CONSUMER_USER', label: `Consumer ${settings.userAlias?.toLowerCase()}` },
    { value: 'BUSINESS_USER', label: `Business ${settings.userAlias?.toLowerCase()}` },
  ];
  const ALL_USER_ENTITY_TYPE_OPTIONS: Array<{
    value: 'CONSUMER_USER' | 'BUSINESS_USER';
    label: string;
    isDisabled?: boolean;
  }> = [
    { value: 'CONSUMER_USER', label: `Consumer ${settings.userAlias?.toLowerCase()}` },
    { value: 'BUSINESS_USER', label: `Business ${settings.userAlias?.toLowerCase()}` },
  ];
  const USER_ENTITY_TYPE_OPTIONS: Array<{ value: 'USER'; label: string; isDisabled?: boolean }> = [
    { value: 'USER', label: firstLetterUpper(settings.userAlias) },
  ];

  const [searchKey, setSearchKey] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [filterParams, setFilterParams] = useState<RuleUniversalSearchFilters>({
    typologies: [],
    checksFor: [],
    defaultNature: [],
    tags: [],
    types:
      ruleType === 'TRANSACTION'
        ? TX_ENTITY_TYPE_OPTIONS[0].value
        : entity === 'CONSUMER_USER'
        ? 'CONSUMER_USER'
        : entity === 'BUSINESS_USER'
        ? 'BUSINESS_USER'
        : ALL_USER_ENTITY_TYPE_OPTIONS[0].value,
  });

  const handleUpdateForm = useCallback((newValues: Partial<FormRuleEntityVariable>) => {
    setFormValues((prevValues) => ({ ...prevValues, ...newValues }));
    if (!newValues.name || Object.keys(newValues).length > 1) {
      setSearchKey(undefined);
    }
  }, []);

  const allVariableOptions = useMemo(() => {
    const filterType = filterParams.types as string;
    const isUserRule = ruleType === 'USER';

    return entityVariables
      .filter((v) => {
        if (isUserRule && (v.entity?.startsWith('TRANSACTION') || !isUserSenderVariable(v.key))) {
          return false;
        }

        let matchesEntityType = false;

        if (filterType === 'TRANSACTION' && v.entity?.startsWith('TRANSACTION')) {
          matchesEntityType = true;
        } else if (filterType === 'CONSUMER_USER') {
          matchesEntityType =
            v.entity?.startsWith('USER') || v.entity?.includes(filterType) || false;
        } else if (filterType === 'BUSINESS_USER') {
          matchesEntityType =
            v.entity?.startsWith('USER') || v.entity?.includes(filterType) || false;
        } else {
          matchesEntityType = true;
        }

        if (!matchesEntityType) {
          return false;
        }

        if (searchKey) {
          return v.uiDefinition.label.toLowerCase().includes(searchKey.toLowerCase());
        }

        return true;
      })
      .map((v) => ({
        itemId: v.key,
        itemName: firstLetterUpper(v.uiDefinition.label.split('/')[1]?.trim()),
        itemDescription: '',
      }));
  }, [entityVariables, ruleType, filterParams.types, searchKey]);

  const entityVariablesFiltered = useMemo(() => {
    return entityVariables.filter((v) => {
      if (formValues.type === 'TRANSACTION') {
        const isOriginEnabled = formValues.transactionDirection === 'ORIGIN';
        const isDestinationEnabled = formValues.transactionDirection === 'DESTINATION';
        const isBothEnabled = formValues.transactionDirection === 'BOTH';
        const isOriginVar = isTransactionOriginVariable(v.key);
        const isDestinationVar = isTransactionDestinationVariable(v.key);
        const isBothVar = isTransactionOriginOrDestinationVariable(v.key);
        return (
          (isOriginEnabled && isOriginVar) ||
          (isDestinationEnabled && isDestinationVar) ||
          (isBothEnabled && isBothVar) ||
          (!(isOriginVar || isDestinationVar) &&
            (v.entity === 'TRANSACTION' || v.entity === 'TRANSACTION_EVENT'))
        );
      } else if (formValues.type === 'USER') {
        const isSenderEnabled = formValues.userType === 'SENDER';
        const isReceiverEnabled = formValues.userType === 'RECEIVER';
        const isBothEnabled = formValues.userType === 'BOTH';
        const isConsumerEnabled = formValues.userNatures?.includes('CONSUMER_USER');
        const isBusinessEnabled = formValues.userNatures?.includes('BUSINESS_USER');
        return (
          ((isSenderEnabled && isUserSenderVariable(v.key)) ||
            (isReceiverEnabled && isUserReceiverVariable(v.key)) ||
            (isBothEnabled && isUserSenderOrReceiverVariable(v.key))) &&
          ((isConsumerEnabled && v.entity === 'CONSUMER_USER') ||
            (isBusinessEnabled && v.entity === 'BUSINESS_USER') ||
            v.entity === 'USER')
        );
      }
    });
  }, [
    entityVariables,
    formValues.transactionDirection,
    formValues.type,
    formValues.userNatures,
    formValues.userType,
  ]);

  // If variable is not available anymore - reset it and reset nested select
  const nestedSelectsRef = useRef<RefType>(null);
  const isVarAvailable = useMemo(() => {
    return entityVariablesFiltered.some((x) => x.key === formValues.entityVariableKey);
  }, [entityVariablesFiltered, formValues.entityVariableKey]);
  const isVarAvailableChanges = useIsChanged(isVarAvailable);
  useEffect(() => {
    const variableKey = formValues.entityVariableKey;
    if (variableKey != null && !isVarAvailable && isVarAvailableChanges) {
      const keyToCheck = oppositeVariableKey(variableKey);
      const newVariableKey = entityVariablesFiltered.find((x) => x.key === keyToCheck)?.key;
      setFormValues((prevState) => ({ ...prevState, entityVariableKey: newVariableKey }));
      nestedSelectsRef.current?.reset(newVariableKey);
    }
  }, [
    entityVariablesFiltered,
    formValues.entityVariableKey,
    formValues.variableKey,
    isVarAvailable,
    isVarAvailableChanges,
  ]);

  // If search key changed - reset nested selects
  const isSearchKeyChanged = useIsChanged(searchKey);
  useEffect(() => {
    const variableKey = formValues.entityVariableKey;
    if (variableKey != null && isSearchKeyChanged) {
      nestedSelectsRef.current?.reset(variableKey);
    }
  }, [formValues.entityVariableKey, isSearchKeyChanged]);

  const filters = useMemo(() => {
    return [
      {
        title: 'Entity type',
        dataType: {
          kind: 'select',
          options: (ruleType === 'TRANSACTION'
            ? ALL_TX_ENTITY_TYPE_OPTIONS
            : ALL_USER_ENTITY_TYPE_OPTIONS
          )
            .map((option) => {
              if (ruleType === 'TRANSACTION') {
                return {
                  value: option.value,
                  label: option.label,
                  isDisabled: false,
                };
              }

              // For user risk factors, implement conditional logic based on entity
              if (entity === 'CONSUMER_USER') {
                if (option.value === 'CONSUMER_USER') {
                  return {
                    value: option.value,
                    label: option.label,
                    isDisabled: true,
                  };
                }
                return null;
              } else if (entity === 'BUSINESS_USER') {
                if (option.value === 'BUSINESS_USER') {
                  return {
                    value: option.value,
                    label: option.label,
                    isDisabled: true,
                  };
                }
                return null;
              }

              // Default: show all options enabled
              return {
                value: option.value,
                label: option.label,
                isDisabled: false,
              };
            })
            .filter(Boolean),
          mode: 'SINGLE',
          displayMode: 'list',
          allowClear: false,
          style: {
            width: '40em',
          },
        },
        kind: 'AUTO',
        key: 'types',
      } as FilterProps<RuleUniversalSearchFilters>,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleType]);

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
      let label = v.uiDefinition.label.split('/')[1].trim();
      if (v.entity?.endsWith('EVENT')) {
        label = `${label} (event)`;
      }

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

  const entityVariable = entityVariables.find((v) => v.key === formValues.entityVariableKey);
  const [isOpen, setIsOpen] = useState(true);
  const isOkDisabled = useMemo(() => {
    return !formValues.entityVariableKey;
  }, [formValues.entityVariableKey]);
  const isEntityUser = ruleType === 'USER' && entity != null;
  return (
    <div>
      <Modal
        width="L"
        title="Entity variable"
        isOpen={isOpen}
        onCancel={() => {
          setIsOpen(false);
          onCancel();
        }}
        onOk={() => {
          if (formValues.entityVariableKey) {
            onUpdate({
              key: formValues.variableKey ?? getNewEntityVariableKey(),
              entityKey: formValues.entityVariableKey,
              name: formValues.name,
              filtersLogic: formValues.filtersLogic,
            });
          }
        }}
        hideOk={readOnly}
        okText={isNew ? 'Add' : 'Update'}
        okProps={{ isDisabled: isOkDisabled }}
        disablePadding
        subTitle="
        Entity variable is used to reference specific fields from an entity or instrument (e.g
        registration period, status, or type)"
      >
        <Card.Section direction="vertical">
          <SearchBar
            readOnly={readOnly}
            search={searchKey}
            onSearch={(value) => {
              setSearchKey(value);
            }}
            onBlur={() => {
              if (formValues.entityVariableKey) {
                const selectedVariable = entityVariables.find(
                  (v) => v.key === formValues.entityVariableKey,
                );
                if (selectedVariable) {
                  setSearchKey(
                    firstLetterUpper(selectedVariable.uiDefinition.label.split('/')[1]?.trim()),
                  );
                } else {
                  setSearchKey('');
                }
              } else {
                setSearchKey('');
              }
            }}
            items={success([{ items: allVariableOptions, title: 'Entity variables' }])}
            variant="minimal"
            onSelectItem={(item) => {
              if (item.itemId) {
                setFormValues(
                  getInitialFormValues(
                    ruleType,
                    { key: getNewEntityVariableKey(), entityKey: item.itemId },
                    entityVariables,
                  ),
                );
              }
            }}
            filters={filters}
            onChangeFilterParams={(params) => {
              setFilterParams(params);
              setSearchKey('');
              setFormValues(
                getInitialFormValues(
                  ruleType,
                  undefined,
                  entityVariables,
                  params.types as 'TRANSACTION' | 'USER',
                ),
              );
            }}
            placeholder="Search for entity variable here or configure below"
            onClear={() => {
              setFormValues({ entityVariableKey: undefined });
            }}
            filterParams={filterParams}
          />
          {/* TODO: add variable name */}
          <Label label="Variable name" required={{ value: false, showHint: true }}>
            <TextInput
              value={formValues.name}
              onChange={(name) => handleUpdateForm({ name })}
              placeholder={entityVariable?.uiDefinition.label || 'Custom variable name'}
              allowClear
              testName="variable-name-v8"
              isDisabled={readOnly}
            />
          </Label>
          <PropertyColumns>
            <Label label="Variable type" required={{ value: true, showHint: true }}>
              <SelectionGroup
                value={formValues.type}
                onChange={(type) => {
                  handleUpdateForm({
                    type: type === 'TRANSACTION' ? 'TRANSACTION' : 'USER',
                    entityVariableKey: undefined,
                    userNatures: undefined,
                  });
                  setFilterParams({
                    ...filterParams,
                    types: type === 'TRANSACTION' ? 'TRANSACTION' : 'CONSUMER_USER',
                  });
                }}
                mode={'SINGLE'}
                options={
                  ruleType === 'TRANSACTION' ? TX_ENTITY_TYPE_OPTIONS : USER_ENTITY_TYPE_OPTIONS
                }
                testName="variable-type-v8"
                isDisabled={readOnly}
              />
            </Label>
            {formValues.type === 'TRANSACTION' && (
              <Label label="Transaction direction">
                <SelectionGroup
                  value={formValues.transactionDirection}
                  onChange={(transactionDirection) => {
                    const shouldResetVariable =
                      formValues.entityVariableKey &&
                      !isDirectionlessVariable(formValues.entityVariableKey);

                    handleUpdateForm({
                      transactionDirection,
                      ...(shouldResetVariable && { entityVariableKey: undefined }),
                    });
                  }}
                  mode={'SINGLE'}
                  options={TX_DIRECTION_OPTIONS}
                  testName="variable-tx-direction-v8"
                  isDisabled={readOnly}
                />
              </Label>
            )}
            {formValues.type === 'USER' && (
              <>
                {ruleType === 'TRANSACTION' && (
                  <Label
                    label={`${firstLetterUpper(settings.userAlias)} type`}
                    required={{ value: true, showHint: true }}
                  >
                    <SelectionGroup
                      value={formValues.userType}
                      onChange={(userType) => {
                        const shouldResetVariable =
                          formValues.entityVariableKey &&
                          !isDirectionlessVariable(formValues.entityVariableKey);

                        handleUpdateForm({
                          userType,
                          ...(shouldResetVariable && { entityVariableKey: undefined }),
                        });
                      }}
                      mode={'SINGLE'}
                      options={USER_TYPE_OPTIONS}
                      testName="variable-user-type-v8"
                      isDisabled={readOnly}
                    />
                  </Label>
                )}
                <Label
                  label={`${firstLetterUpper(settings.userAlias)} nature`}
                  required={{ value: false, showHint: true }}
                >
                  <SelectionGroup
                    value={
                      isEntityUser
                        ? ([entity] as ('CONSUMER_USER' | 'BUSINESS_USER')[])
                        : formValues.userNatures
                    }
                    onChange={(userNatures) =>
                      handleUpdateForm({ userNatures, entityVariableKey: undefined })
                    }
                    mode={'MULTIPLE'}
                    options={USER_NATURE_OPTIONS.filter((opt) =>
                      isEntityUser ? opt.value === entity : true,
                    )}
                    testName="variable-user-nature-v8"
                    isDisabled={readOnly}
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
                value={formValues.entityVariableKey}
                onChange={(entityVariableKey) => handleUpdateForm({ entityVariableKey })}
                isDisabled={readOnly}
              />
            )}
          </PropertyColumns>
          {/* TODO: suppport user event filters */}
          {entityVariable && formValues.type === 'TRANSACTION' && (
            <div>
              {!formValues.filtersLogic && !showFilters && !readOnly ? (
                <Link to="" onClick={() => setShowFilters(true)}>
                  Add filters
                </Link>
              ) : (
                <Label label="Filters">
                  <Alert type="INFO">
                    The system will search from the latest to the earliest{' '}
                    {formValues.type.toLowerCase()} event to find the first match based on your
                    filters
                  </Alert>
                  <VariableFilters
                    entityVariableTypes={getFilterEntityVariableTypes(entityVariable)}
                    readOnly={readOnly}
                    formValuesState={[formValues, setFormValues]}
                    ruleType={ruleType}
                  />
                </Label>
              )}
            </div>
          )}
        </Card.Section>
      </Modal>
    </div>
  );
};
