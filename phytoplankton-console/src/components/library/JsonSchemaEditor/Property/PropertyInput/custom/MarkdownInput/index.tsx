import React, { useContext, useRef } from 'react';
import { InputProps } from '@/components/library/Form';
import { CopilotWrapperContent } from '@/pages/case-management/components/Copilot/CopilotButtonContent';
import { ExtendedSchema, UiSchemaMarkdown } from '@/components/library/JsonSchemaEditor/types';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { SarContext } from '@/components/Sar/SarReportDrawer';
import { CASE_REASONSS } from '@/apis/models-custom/CaseReasons';

interface Props extends InputProps<any> {
  schema: ExtendedSchema;
  uiSchema: UiSchemaMarkdown;
}

export default function MarkdownInput(props: Props) {
  const { schema, value, onChange, ...inputProps } = props;
  const report = useContext(SarContext);
  const editorRef = useRef<MarkdownEditor>(null);

  return (
    <>
      <MarkdownEditor
        {...inputProps}
        ref={editorRef}
        initialValue={value}
        onChange={(newValue) => {
          onChange && onChange(newValue);
        }}
        editorHeight={260}
      />
      {!schema?.hideCopilotWidget && (
        <div style={{ width: '100%' }}>
          <CopilotWrapperContent
            reasons={CASE_REASONSS}
            entityId={report?.id || ''}
            entityType={'REPORT'}
            setNarrativeValue={(narrative) => onChange && onChange(narrative)}
            narrative={value}
          />
        </div>
      )}
    </>
  );
}
