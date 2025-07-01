import React, { useEffect, useState } from 'react';
import s from './style.module.less';
import { AuditLogActionEnum } from '@/apis';
import Button from '@/components/library/Button';
import { AUDIT_LOG_ACTION_ENUMS } from '@/apis/models-custom/AuditLogActionEnum';
import Checkbox from '@/components/library/Checkbox';

interface Props {
  initialState: AuditLogActionEnum[] | [];
  onReset: () => void;
  onConfirm: (value: AuditLogActionEnum[]) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onReset, onConfirm } = props;

  const [state, setState] = useState<AuditLogActionEnum[]>(initialState);

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
        {AUDIT_LOG_ACTION_ENUMS.map((key) => (
          <div key={key} className={s.checkboxItem}>
            <Checkbox
              onChange={(checked) => {
                setState((prev) => {
                  if (checked) {
                    return [...prev, key];
                  }
                  return prev.filter((item) => item !== key);
                });
              }}
              value={state.includes(key)}
            />
            <span>{key}</span>
          </div>
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
