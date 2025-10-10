import React from 'react';
import { useFormState } from '../../hooks';
import s from './index.module.less';
import Alert from '@/components/library/Alert';

interface Props {}

export default function FormValidationErrors<FormValues>(_props: Props): JSX.Element {
  const { validationErrors } = useFormState<FormValues>();

  return (
    <div className={s.root}>
      {validationErrors.map((error, i) => (
        <Alert type={'ERROR'} key={i}>
          {error}
        </Alert>
      ))}
    </div>
  );
}
