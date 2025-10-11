import { useEffect, useRef, useState } from 'react';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import IfTag from '../components/IfTag';
import ThenTag from '../components/ThenTag';
import s from './index.module.less';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import NestedForm from '@/components/library/Form/NestedForm';
import Select from '@/components/library/Select';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { message } from '@/components/library/Message';
import FormValidationErrors from '@/components/library/Form/utils/validation/FormValidationErrors';
import { Validator } from '@/components/library/Form/utils/validation/types';
import { useIsChanged } from '@/utils/hooks';
import { useRoles } from '@/utils/user-utils';
import { WorkflowType } from '@/hooks/api/workflows';

export type FormValues = {
  condition: {
    action: string;
  };
  outcome: {
    status: string;
    assignee: string;
  };
};

const INITIAL_VALUES = { condition: { action: '' }, outcome: { status: '', assignee: '' } };

type Props = {
  availableStatuses: string[];
  availableActions: string[];
  disabledStatuses?: string[];
  disabledActions?: string[];
  workflowType: WorkflowType;
  isVisible: boolean;
  initialValues: Partial<FormValues>;
  formValidators?: Validator<FormValues>[];
  onChangeVisibility: (isVisible: boolean) => void;
  onSubmit: (values: FormValues) => void;
  onDelete?: () => void;
};

export default function TransitionDrawer(props: Props) {
  const {
    workflowType,
    formValidators,
    isVisible,
    availableStatuses,
    availableActions,
    disabledStatuses = [],
    disabledActions = [],
    onChangeVisibility,
    onDelete,
  } = props;
  const formRef = useRef<FormRef<FormValues>>(null);

  const [roles, isLoading] = useRoles();

  const isVisibilityChanged = useIsChanged(isVisible);
  useEffect(() => {
    if (isVisibilityChanged && isVisible) {
      formRef.current?.setValues(props.initialValues as FormValues);
    }
  }, [isVisible, isVisibilityChanged, props.initialValues]);

  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [isValid, setValid] = useState(true);
  useEffect(() => {
    if (!isVisible) {
      setAlwaysShowErrors(false);
    }
  }, [isVisible]);

  const handleDone = () => {
    formRef.current?.submit();
  };
  const handleSubmit = (values: FormValues, state: { isValid: boolean }) => {
    if (!state.isValid) {
      message.error('Please fill all required fields');
      setAlwaysShowErrors(true);
      return;
    }
    props.onSubmit(values);
    onChangeVisibility(false);
  };

  return (
    <Drawer
      isVisible={isVisible}
      onChangeVisibility={onChangeVisibility}
      title="If/Then condition"
      footer={
        onDelete && (
          <Button
            type="DANGER"
            onClick={() => {
              onDelete();
              onChangeVisibility(false);
            }}
          >
            Delete
          </Button>
        )
      }
      footerRight={
        <Button type="PRIMARY" onClick={handleDone} isDisabled={!isValid}>
          Done
        </Button>
      }
    >
      <Form
        className={s.root}
        onChange={({ isValid }) => {
          setValid(isValid);
        }}
        initialValues={INITIAL_VALUES}
        ref={formRef}
        onSubmit={handleSubmit}
        formValidators={formValidators}
        fieldValidators={{
          condition: {
            action: notEmpty,
          },
          outcome: {
            status: notEmpty,
            assignee: notEmpty,
          },
        }}
        alwaysShowErrors={alwaysShowErrors}
      >
        <div className={s.logicSection}>
          <div>
            <IfTag />
          </div>
          <div className={s.logicSectionBody}>
            <NestedForm name="condition">
              <InputField<FormValues['condition'], 'action'>
                name="action"
                label={'Action if true'}
                labelProps={{ required: true }}
              >
                {({ value, onChange }) => (
                  <Select
                    options={availableActions.map((action) => ({
                      label: humanizeAuto(action),
                      value: action,
                      isDisabled: disabledActions.includes(action),
                    }))}
                    value={value}
                    onChange={onChange}
                  />
                )}
              </InputField>
            </NestedForm>
          </div>
        </div>
        <div className={s.logicSection}>
          <div>
            <ThenTag />
          </div>
          <div className={s.logicSectionBody}>
            <NestedForm name="outcome">
              <InputField<FormValues['outcome'], 'status'>
                name="status"
                label={`${humanizeAuto(workflowType)} status is`}
                labelProps={{ required: true }}
              >
                {({ value, onChange }) => (
                  <Select
                    options={availableStatuses.map((status) => ({
                      label: humanizeAuto(status),
                      value: status,
                      isDisabled: disabledStatuses.includes(status),
                    }))}
                    value={value}
                    onChange={onChange}
                  />
                )}
              </InputField>
              <InputField<FormValues['outcome'], 'assignee'>
                name="assignee"
                label="Assignee is"
                labelProps={{ required: true }}
              >
                {({ value, onChange }) => (
                  <Select
                    isDisabled={isLoading}
                    options={roles.map((role) => ({
                      label: role.name,
                      value: role.id,
                    }))}
                    value={value}
                    onChange={onChange}
                  />
                )}
              </InputField>
            </NestedForm>
          </div>
        </div>
        <FormValidationErrors />
      </Form>
    </Drawer>
  );
}
