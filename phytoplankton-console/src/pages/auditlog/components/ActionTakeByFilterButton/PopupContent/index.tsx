import React from 'react';
import { LoadingOutlined } from '@ant-design/icons';
import s from './style.module.less';
import Form from '@/components/library/Form';
import Button from '@/components/library/Button';
import Checkbox from '@/components/library/Checkbox';
import { useUsers } from '@/utils/user-utils';
import Label from '@/components/library/Label';

interface Props {
  initialState: string[] | [];
  onCancel: () => void;
  onConfirm: (value: string[]) => void;
}

export default function PopupContent(props: Props) {
  const { initialState, onCancel, onConfirm } = props;
  const [users, loadingUsers] = useUsers();

  return (
    <Form<string[]>
      initialValues={initialState}
      onSubmit={(state) => {
        onConfirm(state);
      }}
    >
      {({ valuesState: [values, setValues] }) => (
        <div className={s.root}>
          {loadingUsers ? (
            <LoadingOutlined />
          ) : (
            Object.values(users).map((key) => (
              <Label label={key.name ?? key.id} position="RIGHT" level={2}>
                <Checkbox
                  onChange={(value) => {
                    setValues((prev) => {
                      if (value) {
                        return [...prev, key.id];
                      }
                      return prev.filter((item) => item !== key.id);
                    });
                  }}
                  key={key.id}
                  value={values.includes(key.id)}
                />
              </Label>
            ))
          )}
          <div className={s.buttons}>
            <Button htmlType="submit" type="PRIMARY">
              Confirm
            </Button>
            <Button onClick={onCancel}>Reset</Button>
          </div>
        </div>
      )}
    </Form>
  );
}
