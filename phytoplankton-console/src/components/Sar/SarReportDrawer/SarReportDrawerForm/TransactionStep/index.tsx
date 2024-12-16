import { useEffect, useMemo, useState } from 'react';
import s from './index.module.less';
import ArrayItemForm from '@/components/library/Form/ArrayItemForm';
import { JsonSchemaEditorSettings } from '@/components/library/JsonSchemaEditor/settings';
import { Report } from '@/apis';
import JsonSchemaEditor from '@/components/library/JsonSchemaEditor';
import VerticalMenu from '@/components/library/VerticalMenu';
import {
  isResultValid,
  NestedValidationResult,
} from '@/components/library/Form/utils/validation/types';
import NewTransactionForm from '@/components/Sar/SarReportDrawer/SarReportDrawerForm/TransactionStep/NewTransactionForm';
import { useFormState } from '@/components/library/Form/utils/hooks';
import Button from '@/components/library/Button';

interface Props {
  settings: Partial<JsonSchemaEditorSettings>;
  report: Report;
  validationResult?: NestedValidationResult | undefined;
  alwaysShowErrors?: boolean;
}

export default function TransactionStep(props: Props) {
  const { settings, report, validationResult, alwaysShowErrors } = props;
  const formState = useFormState<{ id: string }[]>();

  const transactionIds = useMemo(
    () => formState.values?.map((x) => x.id) ?? [],
    [formState.values],
  );
  const [activeTransaction, setActiveTransaction] = useState<string>(transactionIds[0] ?? 'ADD');
  const activeTransactionIndex = transactionIds.findIndex((id) => id === activeTransaction);

  useEffect(() => {
    if (activeTransaction != 'ADD' && !transactionIds.includes(activeTransaction)) {
      setActiveTransaction(transactionIds[0] ?? 'ADD');
    }
  }, [activeTransaction, transactionIds]);

  const menuItems = transactionIds.map((tid, i) => {
    const validationResultElement = validationResult?.[i];
    return {
      key: tid,
      title: `Transaction ${tid}`,
      isInvalid: alwaysShowErrors && !isResultValid(validationResultElement),
    };
  });

  return (
    <VerticalMenu
      items={[
        ...menuItems,
        {
          key: 'ADD',
          title: 'Add transaction',
        },
      ]}
      active={activeTransaction}
      onChange={setActiveTransaction}
    >
      {activeTransaction === 'ADD' ? (
        <NewTransactionForm
          onSubmit={({ transactionId }) => {
            if (transactionId == null) {
              return;
            }
            formState.setValues((prevState) => [...prevState, { id: transactionId }]);
            setActiveTransaction(transactionId);
          }}
        />
      ) : (
        activeTransactionIndex >= 0 && (
          <ArrayItemForm index={activeTransactionIndex}>
            <div className={s.root}>
              <JsonSchemaEditor
                settings={settings}
                parametersSchema={report?.schema?.transactionSchema}
              />
              <Button
                type={'DANGER'}
                onClick={() => {
                  formState.setValues((prevState) => {
                    return prevState.filter((x) => x.id !== activeTransaction);
                  });
                  if (activeTransactionIndex > 0) {
                    setActiveTransaction(transactionIds[activeTransactionIndex - 1]);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </ArrayItemForm>
        )
      )}
    </VerticalMenu>
  );
}
