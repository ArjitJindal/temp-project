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

const DemoNarrative = `
On July 30, 2023, a cash deposit of $9,800 was made into the account held by Falcon UrbanWheels at NextCentury Financial, Anytown, USA. This transaction is deemed suspicious due to the following factors:

Unusual Transaction Amount: The deposit amount of $9,800 is just below the $10,000 threshold for Currency Transaction Report (CTR) reporting requirements. This suggests an attempt to avoid reporting.

Frequent Structuring: Review of account activity shows a pattern of consistent cash deposits ranging from $9,000 to $9,800 over the past six weeks, all just below the CTR threshold. This structuring behavior raises suspicions of an intentional effort to evade reporting obligations.

Rapid Changes in Deposit Frequency: Prior to this pattern, Falcon UrbanWheels' account exhibited sporadic deposits and was largely inactive. The sudden and consistent series of near-threshold cash deposits deviates from historical banking behavior.

No Observable Source of Funds: There is no evident business or personal justification provided for the repeated cash deposits. Falcon UrbanWheels is not known to be involved in any cash-intensive professions.

Recent Changes in Behavior: Falcon UrbanWheels has also initiated several large transfers to overseas accounts within the past month, without a clear business rationale. This international activity, coupled with unexplained domestic cash deposits, raises concerns about potential illicit financial activity.

Given the observed transaction patterns, structured deposits, and unexplained international transfers, this activity warrants further investigation to determine whether it is indicative of money laundering or other financial improprieties. Law enforcement is advised to evaluate these patterns in context with any potential connections to illicit activities.

`;

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
