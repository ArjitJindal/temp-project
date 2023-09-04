import React, { useContext, useState } from 'react';
import { InputProps } from '@/components/library/Form';
import { CopilotButton } from '@/pages/case-management/components/Copilot/CopilotButtonContent';
import TextArea from '@/components/library/TextArea';
import { ExtendedSchema, UiSchemaNarrative } from '@/components/library/JsonSchemaEditor/types';
import { SarContext } from '@/components/Sar/SarReportDrawer';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';

interface Props extends InputProps<any> {
  schema: ExtendedSchema;
  uiSchema: UiSchemaNarrative;
}

export default function NarrativeInput(props: Props) {
  const { schema, ...inputProps } = props;
  const report = useContext(SarContext);
  const api = useApi();
  const [copilotLoading, setCopilotLoading] = useState(false);
  const onCopilotNarrative = async () => {
    try {
      setCopilotLoading(true);
      const response = await api.generateNarrative({
        NarrativeRequest: {
          entityId: report?.id || '',
          entityType: 'REPORT',
          reasons: [],
        },
      });
      inputProps.onChange && inputProps.onChange(response.narrative);
    } catch (e) {
      message.error('Failed to generate narrative with AI');
    } finally {
      setCopilotLoading(false);
    }
  };

  return (
    <>
      <TextArea {...inputProps} isDisabled={schema.readOnly} />
      <div style={{ width: '200px' }}>
        <CopilotButton loading={copilotLoading} onClick={onCopilotNarrative} />
      </div>
    </>
  );
}
