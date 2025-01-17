import React, { useState } from 'react';
import { Fields } from '@react-awesome-query-builder/core';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import fixture from './story-fixture.json';
import LogicBuilder from './index';
import { UseCase } from '@/pages/storybook/components';
import { makeConfig } from '@/components/ui/LogicBuilder/helpers';
import Toggle from '@/components/library/Toggle';
import Label from '@/components/library/Label';
import { JSON_LOGIC_FUNCTIONS } from '@/components/ui/LogicBuilder/functions';
import VariableInfoModal from '@/components/ui/LogicBuilder/VariableInfoModal';
import { LogicEntityVariableInUse, RuleMachineLearningVariable } from '@/apis';
import { FormRuleAggregationVariable } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard/helpers';

const funcs = {
  ...Object.fromEntries(JSON_LOGIC_FUNCTIONS.map((v) => [v.key, v.uiDefinition])),
};

export default function (): JSX.Element {
  const [showVariablePopover, setShowVariablePopover] = useState<string | null>(null);

  const onClickVariable = (name) => {
    setShowVariablePopover(name);
  };
  const config = makeConfig({
    mode: 'VIEW',
    fields: fixture.fields as Fields,
    funcs: funcs,
    enableNesting: true,
    onClickVariable,
  });

  let selectedVar:
    | FormRuleAggregationVariable
    | LogicEntityVariableInUse
    | RuleMachineLearningVariable
    | undefined = undefined;
  if (showVariablePopover != null) {
    if (showVariablePopover.startsWith('agg:')) {
      selectedVar = fixture.aggregationVariables.find(
        (x) => x.key === showVariablePopover,
      ) as FormRuleAggregationVariable;
    } else {
      selectedVar = fixture.entityVariablesInUse.find((x) => x.key === showVariablePopover);
    }
  }

  return (
    <>
      <VariableInfoModal
        ruleType={'TRANSACTION'}
        entityVariables={fixture.entityVariables as any}
        variable={selectedVar}
        onCancel={() => {
          setShowVariablePopover(null);
        }}
      />
      <UseCase
        title={'View mode'}
        initialState={{
          value: QbUtils.loadFromJsonLogic(fixture.logic, config),
          config: makeConfig({
            mode: 'VIEW',
            fields: fixture.fields as Fields,
            funcs,
            enableNesting: true,
            onClickVariable,
          }),
        }}
      >
        {([state, setState]) => (
          <>
            <Label label={'View mode'} position={'RIGHT'}>
              <Toggle
                size={'S'}
                value={state.isOn ?? true}
                onChange={(value) => {
                  setState((state) => ({
                    isOn: value,
                    value: state.value,
                    config: makeConfig({
                      mode: value ?? true ? 'VIEW' : 'EDIT',
                      fields: fixture.fields as Fields,
                      enableNesting: true,
                      funcs,
                      onClickVariable,
                    }),
                  }));
                }}
              />
            </Label>
            <LogicBuilder
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
              config={state.config}
            />
          </>
        )}
      </UseCase>
      <UseCase
        title={'Basic'}
        initialState={{
          value: undefined,
          config: makeConfig({
            fields: fixture.fields as Fields,
            enableNesting: false,
          }),
        }}
      >
        {([state, setState]) => {
          return (
            <LogicBuilder
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
              config={state.config}
            />
          );
        }}
      </UseCase>
      <UseCase
        title={'Complex conditions enabled'}
        initialState={{
          value: undefined,
          config: makeConfig({
            fields: fixture.fields as Fields,
            enableNesting: true,
          }),
        }}
      >
        {([state, setState]) => {
          return (
            <LogicBuilder
              config={state.config}
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
            />
          );
        }}
      </UseCase>
      <UseCase
        title={'Conjunctions hidden'}
        initialState={{
          value: undefined,
          config: makeConfig({
            fields: fixture.fields as Fields,
            enableNesting: true,
          }),
        }}
      >
        {([state, setState]) => {
          return (
            <LogicBuilder
              config={state.config}
              value={state.value}
              hideConjunctions={true}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
            />
          );
        }}
      </UseCase>
      <UseCase
        title={'Disable reordering'}
        initialState={{
          value: undefined,
          config: makeConfig({
            fields: fixture.fields as Fields,
            enableReorder: false,
          }),
        }}
      >
        {([state, setState]) => {
          return (
            <LogicBuilder
              config={state.config}
              value={state.value}
              onChange={(newValue) => {
                setState((prevState) => ({ ...prevState, value: newValue }));
              }}
            />
          );
        }}
      </UseCase>
    </>
  );
}
