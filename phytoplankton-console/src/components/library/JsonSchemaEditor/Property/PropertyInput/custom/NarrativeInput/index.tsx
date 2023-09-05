import React, { useContext } from 'react';
import { InputProps } from '@/components/library/Form';
import { CopilotWrapperContent } from '@/pages/case-management/components/Copilot/CopilotButtonContent';
import TextArea from '@/components/library/TextArea';
import { ExtendedSchema, UiSchemaNarrative } from '@/components/library/JsonSchemaEditor/types';
import { SarContext } from '@/components/Sar/SarReportDrawer';
import { CASE_REASONSS } from '@/apis/models-custom/CaseReasons';

interface Props extends InputProps<any> {
  schema: ExtendedSchema;
  uiSchema: UiSchemaNarrative;
}

export default function NarrativeInput(props: Props) {
  const { schema, value, onChange, ...inputProps } = props;
  const report = useContext(SarContext);

  return (
    <>
      <TextArea
        {...inputProps}
        value={value}
        onChange={onChange}
        isDisabled={schema.readOnly}
        minHeight={'260px'}
      />
      <div style={{ width: '100%' }}>
        <CopilotWrapperContent
          reasons={CASE_REASONSS}
          entityId={report?.id || ''}
          entityType={'REPORT'}
          setNarrativeValue={(narrative) => onChange && onChange(narrative)}
          narrative={value}
        />
      </div>
    </>
  );
}
