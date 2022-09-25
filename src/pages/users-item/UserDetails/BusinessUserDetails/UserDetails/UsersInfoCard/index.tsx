import React from 'react';
import moment from 'moment';
import { Tag } from 'antd';
import s from './index.module.less';
import { InternalBusinessUser } from '@/apis';
import TimerLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import User3Line from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import DeleteBackLineIcon from '@/components/ui/icons/Remix/system/delete-back-line.react.svg';
import GovernmentLineIcon from '@/components/ui/icons/Remix/buildings/government-line.react.svg';
import { Tag as ApiTag } from '@/apis/models/Tag';
import * as Form from '@/components/ui/Form';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';

interface Props {
  user: InternalBusinessUser;
}

export default function UsersInfoCard(props: Props) {
  const { user } = props;
  return (
    <div className={s.fields}>
      <Form.Layout.Label icon={<User3Line />} title={'User Type'}>
        <div>
          <Tag
            style={{
              backgroundColor: '#E6F8FF',
              borderColor: '#78CBEB',
            }}
          >
            Business
          </Tag>
        </div>
      </Form.Layout.Label>
      <Form.Layout.Label icon={<GovernmentLineIcon />} title={'Business Industry'}>
        {user.legalEntity.companyGeneralDetails.businessIndustry ?? '-'}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<EarthLineIcon />} title={'Main Products and Services'}>
        {user.legalEntity.companyGeneralDetails.mainProductsServicesSold ?? '-'}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<EarthLineIcon />} title={'Reason for opening account'}>
        {user.legalEntity.reasonForAccountOpening ?? '-'}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<TimerLineIcon />} title={'Created on'}>
        {moment(user.createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT)}
      </Form.Layout.Label>
      <Form.Layout.Label icon={<DeleteBackLineIcon />} title={'Tags'}>
        <div>
          {user.tags?.map(({ key, value }: ApiTag) => (
            <Tag color={'cyan'}>
              {key}: <span style={{ fontWeight: 700 }}>{value}</span>
            </Tag>
          ))}
        </div>
      </Form.Layout.Label>
    </div>
  );
}
