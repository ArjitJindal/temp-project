import React, { useState } from 'react';
import { InputProps } from '@/components/library/Form';
import { CopilotButton } from '@/pages/case-management/components/Copilot/CopilotButtonContent';
import TextArea from '@/components/library/TextArea';
import {
  ExtendedSchema,
  UiSchemaNarrative,
} from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/types';
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
  uiSchema: UiSchemaNarrative;
}

const DemoNarrative = `The customer received an inflow of NGN5 million on 13th October 20xx. This is the highest inflow received in the last one year. The customer has done a cumulative credit turnover of NGN300m in the last two and half months (from August to date) and this amounts to 41% of the cumulative credit turnover for the last one-year period reviewed. This shows that recent transactions on the account deviates from usual transaction dynamics. 4. The customer features occasionally on our one-to-many transfer to more than ten customer alerts. He made a transfer to 16 personal accounts on June 11, 20xx, amounting to a total of NGN1bn: and to 16 personal accounts on July 6, 20xx, amounting to a total of NGN8bn. Enhanced due diligence report showed that the customer deals in the supply of sea foods. The seafood industry in the landlocked country of jurisdiction A is a major source of sustenance.`;

export default function NarrativeInput(props: Props) {
  const { schema, ...inputProps } = props;
  const [loading, setLoading] = useState(false);
  return (
    <>
      <TextArea {...inputProps} isDisabled={schema.readOnly} />
      <div style={{ width: '200px' }}>
        <CopilotButton
          loading={loading}
          onClick={() => {
            setLoading(true);
            setTimeout(() => {
              inputProps.onChange && inputProps.onChange(DemoNarrative);
              setLoading(false);
            }, 2000);
          }}
        />
      </div>
    </>
  );
}
