import { Theme } from '@rjsf/antd';
import { withTheme } from '@rjsf/core';
import React, { useEffect } from 'react';

const JSONSchemaForm = withTheme(Theme);

interface JsonSchemaFormProps {
  schema: object;
  formData: any;
  onChange: (event: any) => void;
  readonly?: boolean;
  liveValidate: boolean;
  uiSchema?: any;
  children?: React.ReactNode;
}

export const JsonSchemaForm = (props: JsonSchemaFormProps) => {
  const { schema, formData, onChange, readonly, liveValidate, uiSchema, children } = props;

  useEffect(() => {
    const callback = (event: any) => {
      if (event.target.type === 'number') {
        event.target.blur();
      }
    };
    document.addEventListener('wheel', callback);
    return () => document.removeEventListener('wheel', callback);
  }, []);

  return (
    <JSONSchemaForm
      schema={schema}
      formData={formData}
      onChange={onChange}
      readonly={readonly}
      liveValidate={liveValidate}
      uiSchema={uiSchema}
    >
      {children}
    </JSONSchemaForm>
  );
};
