import { useEffect, useMemo, useState } from 'react';
import { useSarContext } from '../..';
import styles from '../index.module.less';
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
import NewTransactionForm from '@/components/Sar/SarReport/SarReportForm/TransactionStep/NewTransactionForm';
import { useFormState } from '@/components/library/Form/utils/hooks';
import Button from '@/components/library/Button';
import { Option } from '@/components/library/Select';
import * as Card from '@/components/ui/Card';

export type TransactionStepContextValue = {
  activeTransactionId: string;
};

interface Props {
  settings: Partial<JsonSchemaEditorSettings>;
  report: Report;
  validationResult?: NestedValidationResult | undefined;
  alwaysShowErrors?: boolean;
}

export default function TransactionStep(props: Props) {
  const { settings, report, validationResult, alwaysShowErrors } = props;
  const formState = useFormState<{ id: string }[]>();
  const data = useSarContext<TransactionStepContextValue>();

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

  useEffect(() => {
    data?.setMetaData('activeTransactionId', activeTransaction);
  }, [activeTransaction]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectableTransactionIds = useMemo(() => {
    const options: Option<string>[] = [];
    report.parameters.transactions?.forEach((tx) => {
      options.push({
        label: tx.id,
        value: tx.id,
        isDisabled: transactionIds.includes(tx.id),
      });
    });
    return options;
  }, [transactionIds, report.parameters.transactions]);

  const menuItems = transactionIds.map((tid, i) => {
    const validationResultElement = validationResult?.[i];
    return {
      key: tid,
      title: `Transaction ${tid}`,
      isInvalid: alwaysShowErrors && !isResultValid(validationResultElement),
    };
  });

  return (
    <div className={styles.formWrapper}>
      <Card.Root className={styles.stepWrapper}>
        <Card.Section>
          <VerticalMenu
            items={[...menuItems, { key: 'ADD', title: 'Add transaction' }]}
            active={activeTransaction}
            onChange={setActiveTransaction}
          />
        </Card.Section>
      </Card.Root>
      <Card.Root className={styles.formContent}>
        <Card.Section>
          {activeTransaction === 'ADD' ? (
            <NewTransactionForm
              onSubmit={({ transactionId }) => {
                if (transactionId == null) {
                  return;
                }
                formState.setValues((prevState) => [
                  ...prevState,
                  {
                    id: transactionId,
                    ...report.parameters.transactions?.find((x) => x.id === transactionId)
                      ?.transaction,
                  },
                ]);
                setActiveTransaction(transactionId);
              }}
              transactionIds={selectableTransactionIds}
            />
          ) : (
            activeTransactionIndex >= 0 && (
              <ArrayItemForm index={activeTransactionIndex}>
                <div className={s.root}>
                  <JsonSchemaEditor
                    settings={settings}
                    parametersSchema={report?.schema?.transactionSchema}
                    className={s.schemaEditor}
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
        </Card.Section>
      </Card.Root>
    </div>
  );
}
