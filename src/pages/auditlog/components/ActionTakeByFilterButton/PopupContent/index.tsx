import { Form as AntForm, Checkbox } from 'antd';
import React, { useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import s from './style.module.less';
import * as Form from '@/components/ui/Form';
import Button from '@/components/ui/Button';
import { useUsers } from '@/utils/user-utils';

interface Props {
  initialState: string[] | [];
  onCancel: () => void;
  onConfirm: (value: string[]) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm } = props;
  const [users, loadingUsers] = useUsers();

  const [state, setState] = useState<string[]>(initialState);

  return (
    <AntForm
      onFinish={() => {
        onConfirm(state);
      }}
    >
      <div className={s.root}>
        <Form.Layout.Label title="Action Taken By">
          {loadingUsers ? (
            <LoadingOutlined />
          ) : (
            Object.values(users).map((key) => {
              return (
                <Checkbox
                  onChange={(e) => {
                    setState((prev) => {
                      if (e.target.checked) {
                        return [...prev, key.id];
                      }
                      return prev.filter((item) => item !== key.id);
                    });
                  }}
                  key={key.id}
                  checked={state.includes(key.id)}
                  style={{ margin: '0' }}
                >
                  {key.name ?? key.id}
                </Checkbox>
              );
            })
          )}
        </Form.Layout.Label>
        <div className={s.buttons}>
          <Button htmlType="submit" type="primary">
            Confirm
          </Button>
          <Button onClick={onCancel}>Reset</Button>
        </div>
      </div>
    </AntForm>
  );
}
