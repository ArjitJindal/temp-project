import { Checkbox, Form as AntForm } from 'antd';
import React, { useEffect, useState } from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import s from './style.module.less';
import Button from '@/components/library/Button';
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

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  return (
    <AntForm
      onFinish={() => {
        onConfirm(state);
      }}
    >
      <div className={s.root}>
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
