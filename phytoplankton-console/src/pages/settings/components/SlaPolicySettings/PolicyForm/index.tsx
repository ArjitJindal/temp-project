import React, { useState } from 'react';
import { message } from 'antd';
import { FormValues } from '../utils/utils';
import PolicyConfigurationTable from './components/PolicyConfigurationTable';
import s from './styles.module.less';
import { SLAPolicyIdResponse } from '@/apis';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import NestedForm from '@/components/library/Form/NestedForm';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import TextInput from '@/components/library/TextInput';
import Label from '@/components/library/Label';
import { H4 } from '@/components/ui/Typography';
import { useQuery } from '@/utils/queries/hooks';
import { SLA_POLICY_ID } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { getOr } from '@/utils/asyncResource';
import FormValidationErrors from '@/components/library/Form/utils/validation/FormValidationErrors';

interface Props {
  handleEdit: (values: FormValues) => void;
  handleCreate: (values: FormValues) => void;
  mode: 'CREATE' | 'EDIT';
  initialValues: FormValues;
  formRef: React.RefObject<FormRef<any>>;
  onChange?: (values: FormValues) => void;
}

function PolicyConfigurationForm(props: Props) {
  const { handleCreate, handleEdit, initialValues, mode, onChange } = props;
  const api = useApi();
  const queryResult = useQuery<SLAPolicyIdResponse>(
    SLA_POLICY_ID(initialValues.id || 'new'),
    async () => {
      return await api.getNewSlaId();
    },
    {
      enabled: mode === 'CREATE',
      staleTime: 0,
      cacheTime: 0,
    },
  );
  const [showErrors, setShowErrors] = useState(false);
  const newId = getOr(queryResult.data, { id: '' }).id;
  initialValues.id = mode === 'CREATE' ? newId : initialValues.id;
  return (
    <Form<FormValues>
      initialValues={initialValues}
      onSubmit={(values, { isValid }) => {
        if (!isValid) {
          message.warn(
            'Please, make sure that all required fields are filled and values are valid!',
          );
          setShowErrors(true);
          return;
        }
        if (mode === 'CREATE') {
          handleCreate(values);
        } else {
          handleEdit(values);
        }
      }}
      onChange={(values) => {
        if (onChange) {
          onChange(values.values);
        }
      }}
      alwaysShowErrors={showErrors}
      ref={props.formRef}
      fieldValidators={{
        id: (id) => (!id ? 'ID is required' : null),
        name: (name) => (!name ? 'Name is required' : null),
        description: (description) => (!description ? 'Description is required' : null),
        policyConfiguration: (policyConfiguration) => {
          if (!policyConfiguration) {
            return 'Policy configuration is required';
          }
          if (!policyConfiguration.SLATime.breachTime) {
            return 'Breach time is required';
          }
          if (!policyConfiguration.alertStatusDetails.alertStatuses) {
            return 'Alert statuses is required';
          }
          if (!policyConfiguration.workingDays) {
            return 'Working days is required';
          }
          return null;
        },
      }}
      formValidators={[
        (values) => {
          const warningTimeinHours = values.policyConfiguration.SLATime.warningTime
            ? values.policyConfiguration.SLATime.warningTime?.units *
              (values.policyConfiguration.SLATime.warningTime.granularity === 'hours' ? 1 : 24)
            : 0;
          const breachTimeinHours =
            values.policyConfiguration.SLATime.breachTime.units *
            (values.policyConfiguration.SLATime.breachTime.granularity === 'hours' ? 1 : 24);

          if (warningTimeinHours > breachTimeinHours) {
            return 'Warning time should be less than service level agreement time';
          }
          return null;
        },
      ]}
    >
      <div className={s.root}>
        <PropertyListLayout>
          <Label label={<H4 bold>Policy details</H4>} required={{ value: true, showHint: true }} />
          <div className={s.section}>
            <InputField<FormValues, 'id'>
              name={'id'}
              label={'ID'}
              labelProps={{ required: { value: true, showHint: true } }}
            >
              {(inputProps) => <TextInput {...inputProps} isDisabled={true} />}
            </InputField>
            <InputField<FormValues, 'name'>
              name={'name'}
              label={'Name'}
              labelProps={{ required: { value: true, showHint: true } }}
            >
              {(inputProps) => <TextInput {...inputProps} />}
            </InputField>
          </div>
          <InputField<FormValues, 'description'>
            name={'description'}
            label={'Description'}
            labelProps={{ required: { value: true, showHint: true } }}
          >
            {(inputProps) => <TextInput {...inputProps} />}
          </InputField>
          <NestedForm name={'policyConfiguration'}>
            <Label
              label={<H4 bold>Policy configuration</H4>}
              required={{ value: true, showHint: true }}
            />
            <PolicyConfigurationTable />
          </NestedForm>
          <FormValidationErrors />
        </PropertyListLayout>
      </div>
    </Form>
  );
}

export default PolicyConfigurationForm;
