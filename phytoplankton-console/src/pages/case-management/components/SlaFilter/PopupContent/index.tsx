import React from 'react';
import s from './styles.module.less';
import { SLAPolicyStatus } from '@/apis/models/SLAPolicyStatus';
import Select, { Option } from '@/components/library/Select';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import Button from '@/components/library/Button';

interface Props {
  slaPolicyOptions: Option<string>[];
  policyStatusOptions: Option<SLAPolicyStatus>[];
  handleClose: () => void;
  onConfirm: (slaPolicyId?: Array<string>, slaPolicyStatus?: Array<SLAPolicyStatus>) => void;
  formRef?: React.Ref<FormRef<any>>;
  slaPolicyId?: Array<string>;
  slaPolicyStatus?: Array<SLAPolicyStatus>;
}

interface FormValues {
  slaPolicyId?: Array<string>;
  slaPolicyStatus?: Array<SLAPolicyStatus>;
}

function PopupContent(props: Props) {
  const { slaPolicyOptions, policyStatusOptions, slaPolicyId, slaPolicyStatus } = props;
  return (
    <Form
      initialValues={{
        slaPolicyId,
        slaPolicyStatus,
      }}
      onSubmit={(values) => {
        props.onConfirm(values.slaPolicyId, values.slaPolicyStatus);
        props.handleClose();
      }}
      ref={props.formRef}
    >
      <div className={s.root}>
        <InputField<FormValues, 'slaPolicyId'>
          name={'slaPolicyId'}
          label={'Policy'}
          labelProps={{ level: 2 }}
        >
          {(inputProps) => (
            <Select<string> {...inputProps} options={slaPolicyOptions} mode="MULTIPLE" />
          )}
        </InputField>
        <InputField<FormValues, 'slaPolicyStatus'>
          name={'slaPolicyStatus'}
          label={'Status'}
          labelProps={{ level: 2 }}
        >
          {(inputProps) => (
            <Select<SLAPolicyStatus>
              {...inputProps}
              options={policyStatusOptions}
              mode="MULTIPLE"
            />
          )}
        </InputField>
        <div className={s.buttons}>
          <Button htmlType="submit" type="PRIMARY">
            Confirm
          </Button>
          <Button
            onClick={() => {
              props.handleClose();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Form>
  );
}

export default PopupContent;
