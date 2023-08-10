import { Tag } from 'antd';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import React from 'react';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';
import * as Form from '@/components/ui/Form';
import { getUserName } from '@/utils/api/users';
import User3Line from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import GovernmentLineIcon from '@/components/ui/icons/Remix/buildings/government-line.react.svg';
import TimerLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';

type UserProps = {
  user: InternalBusinessUser | InternalConsumerUser;
};

export const UserCard = (props: UserProps) => {
  const { user } = props;
  return (
    <PropertyColumns>
      <Form.Layout.Label title={'Name'}>{getUserName(user)}</Form.Layout.Label>
      <Form.Layout.Label icon={<User3Line />} title={'User type'}>
        <div>
          <Tag
            style={{
              backgroundColor: '#E6F8FF',
              borderColor: '#78CBEB',
            }}
          >
            {sentenceCase(user.type)}
          </Tag>
        </div>
      </Form.Layout.Label>
      {user.type === 'BUSINESS' && (
        <Form.Layout.Label icon={<GovernmentLineIcon />} title={'Business industry'}>
          <div>
            {user.legalEntity?.companyGeneralDetails?.businessIndustry
              ? user.legalEntity?.companyGeneralDetails?.businessIndustry.map((industry) => {
                  return <Tag>{industry}</Tag>;
                })
              : '-'}
          </div>
        </Form.Layout.Label>
      )}
      <Form.Layout.Label icon={<TimerLineIcon />} title={'Created on'}>
        {dayjs(user.createdTimestamp).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}
      </Form.Layout.Label>
    </PropertyColumns>
  );
};
