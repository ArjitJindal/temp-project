import { useEffect, useRef, useState } from 'react';
import s from './index.module.less';
import Drawer from '@/components/library/Drawer';
import Button from '@/components/library/Button';
import Form, { FormRef } from '@/components/library/Form';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { message } from '@/components/library/Message';
import FormValidationErrors from '@/components/library/Form/utils/validation/FormValidationErrors';
import { Validator } from '@/components/library/Form/utils/validation/types';
import { useIsChanged } from '@/utils/hooks';
import { useRoles } from '@/utils/api/auth';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';

export type FormValues = {
  role: string;
};

const INITIAL_VALUES = {
  role: '',
};

type Props = {
  rolesInUse: string[];
  isVisible: boolean;
  initialValues: Partial<FormValues>;
  formValidators?: Validator<FormValues>[];
  onChangeVisibility: (isVisible: boolean) => void;
  onSubmit: (values: FormValues) => void;
  onDelete?: () => void;
};

export default function ChainElementDrawer(props: Props) {
  const { rolesInUse, formValidators, isVisible, onChangeVisibility, onDelete } = props;
  const formRef = useRef<FormRef<FormValues>>(null);

  const { rolesList, isLoading } = useRoles();
  const rolesOptions = rolesList.map((role) => ({
    label: role.name,
    value: role.id,
    isDisabled: rolesInUse.includes(role.id) && role.id !== props.initialValues.role,
  }));

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
      drawerMaxWidth={'500px'}
      isVisible={isVisible}
      onChangeVisibility={onChangeVisibility}
      title={onDelete ? 'Change role' : 'Add new role'}
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
      <Form<FormValues>
        className={s.root}
        onChange={({ isValid }) => {
          setValid(isValid);
        }}
        initialValues={INITIAL_VALUES}
        ref={formRef}
        onSubmit={handleSubmit}
        formValidators={formValidators}
        fieldValidators={{
          role: notEmpty,
        }}
        alwaysShowErrors={alwaysShowErrors}
      >
        <InputField<FormValues, 'role'> name="role" label="Role is" labelProps={{ required: true }}>
          {({ value, onChange }) => (
            <Select
              isDisabled={isLoading}
              options={rolesOptions}
              value={value}
              onChange={onChange}
            />
          )}
        </InputField>
        <FormValidationErrors />
      </Form>
    </Drawer>
  );
}
