import { Checkbox } from 'antd';
import React, { useEffect, useState } from 'react';
import s from './style.module.less';
import { AuditLogType } from '@/apis';
import Button from '@/components/library/Button';

interface Props {
  initialState: AuditLogType[] | [];
  onReset: () => void;
  onConfirm: (value: AuditLogType[]) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onReset, onConfirm } = props;

  const keys: AuditLogType[] = ['RULE', 'ACCOUNT', 'USER', 'CASE', 'ALERT'];

  const [state, setState] = useState<AuditLogType[]>(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(state);
      }}
    >
      <div className={s.root}>
        {keys.map((key) => (
          <Checkbox
            key={key}
            onChange={(e) => {
              setState((prev) => {
                if (e.target.checked) {
                  return [...prev, key];
                }
                return prev.filter((item) => item !== key);
              });
            }}
            value={key}
            checked={state.includes(key)}
            style={{ margin: '0' }}
          >
            {key}
          </Checkbox>
        ))}
        <div className={s.buttons}>
          <Button htmlType="submit" type="PRIMARY">
            Confirm
          </Button>
          <Button onClick={onReset}>Reset</Button>
        </div>
      </div>
    </form>
  );
}
