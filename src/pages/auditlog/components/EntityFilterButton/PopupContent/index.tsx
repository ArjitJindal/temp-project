import { Form as AntForm, Checkbox } from 'antd';
import React, { useState } from 'react';
import s from './style.module.less';
import { AuditLogType } from '@/apis';
import * as Form from '@/components/ui/Form';
import Button from '@/components/library/Button';

interface Props {
  initialState: AuditLogType[] | [];
  onCancel: () => void;
  onConfirm: (value: AuditLogType[]) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm } = props;

  const keys: AuditLogType[] = ['RULE', 'ACCOUNT', 'USER', 'CASE'];

  const [state, setState] = useState<AuditLogType[]>(initialState);

  return (
    <AntForm
      onFinish={() => {
        onConfirm(state);
      }}
    >
      <div className={s.root}>
        <Form.Layout.Label title="Entity">
          <Checkbox.Group style={{ display: 'contents' }}>
            {keys.map((key) => (
              <Checkbox
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
          </Checkbox.Group>
        </Form.Layout.Label>
        <div className={s.buttons}>
          <Button htmlType="submit" type="PRIMARY">
            Confirm
          </Button>
          <Button onClick={onCancel}>Reset</Button>
        </div>
      </div>
    </AntForm>
  );
}
