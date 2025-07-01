import React, { useEffect, useState } from 'react';
import s from './style.module.less';
import { AuditLogType } from '@/apis';
import Button from '@/components/library/Button';
import { AUDIT_LOG_TYPES } from '@/apis/models-custom/AuditLogType';
import Checkbox from '@/components/library/Checkbox';

interface Props {
  initialState: AuditLogType[] | [];
  onReset: () => void;
  onConfirm: (value: AuditLogType[]) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onReset, onConfirm } = props;

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
        {AUDIT_LOG_TYPES.map((key) => (
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
          <Button htmlType="submit" type="PRIMARY" testName="auditlog-entity-confirm">
            Confirm
          </Button>
          <Button testName="auditlog-entity-reset" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>
    </form>
  );
}
