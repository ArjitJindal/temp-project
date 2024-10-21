import { useState } from 'react';
import { JsonSchemaEditorSettings } from '@/components/library/JsonSchemaEditor/settings';
import { Report } from '@/apis';
import JsonSchemaEditor from '@/components/library/JsonSchemaEditor';
import VerticalMenu from '@/components/library/VerticalMenu';
import NestedForm from '@/components/library/Form/NestedForm';
import { NestedValidationResult } from '@/components/library/Form/utils/validation/types';

interface Props {
  settings: Partial<JsonSchemaEditorSettings>;
  report: Report;
  validationResult?: NestedValidationResult | undefined;
  alwaysShowErrors?: boolean;
}

export default function TransactionStep(props: Props) {
  const { settings, report, validationResult, alwaysShowErrors } = props;
  const transactionIds = report.parameters.transactions?.map((t) => t.id) ?? [];
  const [activeTransaction, setActiveTransaction] = useState<string>(transactionIds[0]);

  const menuItems = transactionIds.map((tid) => {
    const validationResultElement = validationResult?.[tid];
    return {
      key: tid,
      title: `Transaction ${tid}`,
      isInvalid:
        alwaysShowErrors && validationResultElement != null && !validationResultElement.isValid,
    };
  });

  return (
    <VerticalMenu items={menuItems} active={activeTransaction} onChange={setActiveTransaction}>
      <NestedForm name={activeTransaction}>
        <JsonSchemaEditor
          settings={settings}
          parametersSchema={report?.schema?.transactionSchema}
        />
      </NestedForm>
    </VerticalMenu>
  );
}
