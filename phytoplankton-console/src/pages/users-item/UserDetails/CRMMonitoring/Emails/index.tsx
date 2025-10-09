import { Collapse } from 'antd';
import { sortBy } from 'lodash';
import { useRef, useState } from 'react';
import CRMCommunicationCard from '../CRMCommunicationCard';
import s from './index.module.less';
import { CrmAccountResponseEngagements } from '@/apis';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import Button from '@/components/library/Button';
import EditLineIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import Modal from '@/components/library/Modal';
import Form, { FormRef } from '@/components/library/Form';
import { useId } from '@/utils/hooks';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { message } from '@/components/library/Message';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import { useAuth0User } from '@/utils/user-utils';

interface Props {
  engagements: Array<CrmAccountResponseEngagements>;
  setEmails: (engagements: Array<CrmAccountResponseEngagements>) => void;
}

interface FormValues {
  subject: string;
  content: string;
  to: string[];
}

const { Panel } = Collapse;
const Emails = (props: Props) => {
  const { engagements: emails, setEmails } = props;
  const [modalOpen, setIsModalOpen] = useState(false);
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const user = useAuth0User();

  const formId = useId();
  const formRef = useRef<FormRef<FormValues>>();

  return (
    <>
      <Collapse defaultActiveKey={['1']} ghost>
        {sortBy(emails, 'createdAt')
          .reverse()
          .map((thisEmail, i) => (
            <Panel
              header={
                <div className={s.panel}>
                  <div className={s.panelHeader}>
                    <span className={s.panelHeading}>
                      {thisEmail.subject ? thisEmail.subject : 'No subject'}
                    </span>
                    {thisEmail.createdAt && (
                      <span className={s.greyText}>
                        {dayjs(thisEmail.createdAt).format(DEFAULT_DATE_TIME_FORMAT)}
                      </span>
                    )}
                  </div>
                </div>
              }
              key={i}
            >
              <div className={s.emails}>
                <CRMCommunicationCard
                  name={thisEmail.user}
                  to={thisEmail.to}
                  body={thisEmail.content}
                  createdAt={thisEmail.createdAt}
                  tab="emails"
                />
              </div>
            </Panel>
          ))}
        <Button icon={<EditLineIcon />} onClick={() => setIsModalOpen(true)}>
          Compose
        </Button>
      </Collapse>
      <Modal
        title="Compose an email"
        isOpen={modalOpen}
        okText={'Send'}
        onCancel={() => {
          setIsModalOpen(false);
          setAlwaysShowErrors(false);
        }}
        onOk={() => formRef.current?.submit()}
        destroyOnClose
      >
        <Form<FormValues>
          key={formId}
          id={formId}
          ref={formRef}
          initialValues={{
            subject: '',
            content: '',
            to: [],
          }}
          fieldValidators={{
            subject: notEmpty,
            content: notEmpty,
            to: (values) => {
              if (!values) {
                return "Recipients can't be empty";
              }
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              const allValidEmail = values.every((email) => emailRegex.test(email));
              if (!allValidEmail) {
                return 'Recipient emails are not valid';
              }
              return null;
            },
          }}
          alwaysShowErrors={alwaysShowErrors}
          onSubmit={(values, state) => {
            if (!state.isValid) {
              message.warn(
                'Please, make sure that all required fields are filled and values are valid!',
              );
              setAlwaysShowErrors(true);
              return;
            } else {
              const newEmail: CrmAccountResponseEngagements = {
                subject: values.subject,
                content: values.content,
                createdAt: Date.now(),
                to: values.to,
                user: `${user.name ?? user.verifiedEmail} - ${user.role}`,
              };
              setEmails([newEmail, ...emails]);
              setIsModalOpen(false);
              setAlwaysShowErrors(false);
              // Reset the form after successful submission
              formRef.current?.resetFields();
            }
          }}
        >
          {() => {
            return (
              <div className={s.root}>
                <InputField<FormValues, 'subject'>
                  name={'subject'}
                  label={'Subject'}
                  labelProps={{
                    required: {
                      value: true,
                      showHint: true,
                    },
                  }}
                >
                  {(inputProps) => (
                    <TextInput {...inputProps} placeholder={'Brief description of the email'} />
                  )}
                </InputField>
                <InputField<FormValues, 'to'>
                  name={'to'}
                  label={'Recipients'}
                  labelProps={{
                    required: {
                      value: true,
                      showHint: true,
                    },
                  }}
                >
                  {(inputProps) => (
                    <TextInput
                      placeholder={'Recipients (multiple recipients should be comma separated)'}
                      value={inputProps.value ? inputProps.value.join(',') : ''}
                      onChange={(value) => {
                        if (value) {
                          const emails = value.split(',').map((email) => email.trim());
                          if (inputProps.onChange) {
                            inputProps.onChange(emails);
                          }
                        }
                      }}
                    />
                  )}
                </InputField>
                <InputField<FormValues, 'content'>
                  name={'content'}
                  label={'Body'}
                  labelProps={{
                    required: {
                      value: true,
                      showHint: true,
                    },
                  }}
                >
                  {(inputProps) => (
                    <TextArea {...inputProps} placeholder={'Content of the email'} />
                  )}
                </InputField>
              </div>
            );
          }}
        </Form>
      </Modal>
    </>
  );
};

export default Emails;
