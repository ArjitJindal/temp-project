import React from 'react';
import { InputProps } from '@/components/library/Form';
import { CopilotWrapperContent } from '@/pages/case-management/components/Copilot/CopilotButtonContent';
import TextArea from '@/components/library/TextArea';
import { ExtendedSchema, UiSchemaNarrative } from '@/components/library/JsonSchemaEditor/types';
import { useSarContext } from '@/components/Sar/SarReport';
import { TransactionStepContextValue } from '@/components/Sar/SarReport/SarReportForm/TransactionStep';

interface Props extends InputProps<any> {
  schema: ExtendedSchema;
  uiSchema: UiSchemaNarrative;
}

export default function NarrativeInput(props: Props) {
  const { schema, value, onChange, ...inputProps } = props;
  const data = useSarContext<TransactionStepContextValue>();
  const report = data?.report;

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
          reasons={[]}
          entityId={report?.id || ''}
          entityType={'REPORT'}
          setNarrativeValue={(narrative) => onChange && onChange(narrative)}
          narrative={value}
          additionalCopilotInfo={{
            additionalSarInformation: {
              title: schema.title,
              description: schema.description,
              transactionId: data?.metaData.activeTransactionId,
              reportType: data?.report.reportTypeId,
            },
          }}
        />
      </div>
    </>
  );
}
