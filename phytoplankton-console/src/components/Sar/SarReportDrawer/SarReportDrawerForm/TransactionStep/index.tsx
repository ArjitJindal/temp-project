import { useState } from 'react';
import { JsonSchemaEditorSettings } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/settings';
import { Report } from '@/apis';
import JsonSchemaEditor from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor';
import VerticalMenu from '@/components/library/VerticalMenu';
import NestedForm from '@/components/library/Form/NestedForm';

interface Props {
  settings: Partial<JsonSchemaEditorSettings>;
  report: Report;
}

export default function TransactionStep(props: Props) {
  const { settings, report } = props;
  const transactionIds = report.parameters.transactions?.map((t) => t.id) ?? [];
  const [activeTransaction, setActiveTransaction] = useState<string>(transactionIds[0]);

  return (
    <VerticalMenu
      items={transactionIds.map((tid) => ({ key: tid, title: `Transaction ${tid}` }))}
      active={activeTransaction}
      onChange={setActiveTransaction}
    >
      <NestedForm name={activeTransaction}>
        <JsonSchemaEditor
          settings={settings}
          parametersSchema={report?.schema?.transactionSchema}
        />
      </NestedForm>
    </VerticalMenu>
  );
}
