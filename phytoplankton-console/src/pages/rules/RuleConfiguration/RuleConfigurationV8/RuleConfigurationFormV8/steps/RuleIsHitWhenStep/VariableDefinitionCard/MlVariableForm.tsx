import React, { useCallback, useState } from 'react';
import s from './style.module.less';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import { RuleMachineLearningVariable, RuleMLModel } from '@/apis';
import TextInput from '@/components/library/TextInput';
import Select from '@/components/library/Select';
import Modal from '@/components/library/Modal';
import Tooltip from '@/components/library/Tooltip';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Tag from '@/components/library/Tag';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import { useRuleMlModels } from '@/utils/api/rules';

type FormRuleMlVariable = {
  name?: string;
  modelKey?: string;
};

interface MlVariableFormProps {
  variable?: RuleMachineLearningVariable;
  isNew: boolean;
  readOnly?: boolean;
  onUpdate: (newEntityVariable: RuleMachineLearningVariable) => void;
  onCancel: () => void;
}

export const MlVariableForm: React.FC<MlVariableFormProps> = ({
  variable,
  isNew,
  readOnly,
  onUpdate,
  onCancel,
}) => {
  const queryResult = useRuleMlModels();
  const [formValues, setFormValues] = useState<FormRuleMlVariable>({
    modelKey: variable?.key,
    name: variable?.name,
  });
  const handleUpdateForm = useCallback(
    (newValues: Partial<FormRuleMlVariable>) => {
      setFormValues((prevValues) => ({ ...prevValues, ...newValues }));
    },
    [setFormValues],
  );
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div>
      <Modal
        width="L"
        title="ML variable"
        isOpen={isOpen}
        onCancel={() => {
          setIsOpen(false);
          onCancel();
        }}
        onOk={() => {
          if (formValues.modelKey) {
            onUpdate({
              key: formValues.modelKey,
              name: formValues.name,
              valueType: 'number',
            });
            setIsOpen(false);
          }
        }}
        hideOk={readOnly}
        okText={isNew ? 'Add' : 'Update'}
        okProps={{ isDisabled: false }}
        disablePadding
        subTitle={
          <div>
            Select from either{' '}
            <Tooltip title="Explainable model will show alert explainability reasons after hit.">
              <span className={s.tooltip}>explainable ML model</span>
            </Tooltip>{' '}
            or non-explainable ML model for the rule to run.
          </div>
        }
      >
        <AsyncResourceRenderer resource={queryResult.data}>
          {(models: RuleMLModel[]) => {
            return (
              <Card.Section direction="vertical">
                <Label label="Variable name" required={{ value: false, showHint: true }}>
                  <TextInput
                    value={formValues.name}
                    onChange={(name) => handleUpdateForm({ name })}
                    placeholder={'Auto-generated if left empty'}
                    allowClear
                    testName="variable-name-v8"
                  />
                </Label>
                <Label label="ML model" required={{ value: true, showHint: true }}>
                  <Select
                    options={models
                      ?.filter((model) => model.enabled)
                      .map((model) => ({
                        value: model.id,
                        label: (
                          <div className={s.option}>
                            <div className={s.optionLabel}>
                              <span className={s.optionHeader}>{model.name}</span>
                              <div className={s.tags}>
                                {model.checksFor?.map((check, index) => {
                                  <Tag color="action" key={index}>
                                    {check}
                                  </Tag>;
                                })}
                              </div>
                              <Tag color="blue">
                                <div className={s.tag}>
                                  <AiForensicsLogo size={'SMALL'} /> Explainable model
                                </div>
                              </Tag>
                            </div>
                            <span className={s.optionDescription}>{model.description}</span>
                          </div>
                        ),
                        labelText: model.name,
                      }))}
                    value={formValues.modelKey}
                    onChange={(modelKey) => {
                      const selectedModelName = models.find((model) => model.id === modelKey)?.name;
                      return handleUpdateForm({
                        modelKey,
                        ...(formValues.name || !selectedModelName
                          ? {}
                          : { name: selectedModelName + ' confidence score' }),
                      });
                    }}
                    placeholder="Select ML model"
                  />
                </Label>
              </Card.Section>
            );
          }}
        </AsyncResourceRenderer>
      </Modal>
    </div>
  );
};
