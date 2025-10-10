import { startCase } from 'lodash';
import React from 'react';
import * as Card from '@/components/ui/Card';
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';
import * as Form from '@/components/ui/Form';
import Button from '@/components/library/Button';
import UserTypeTag from '@/components/library/Tag/UserTypeTag';

type AttributePanelProps = {
  attributeId: string;
  isFollowEnabled: boolean;
  followed: string[];
  onFollow: (id: string) => void;
};
export const AttributePanel = (props: AttributePanelProps) => {
  const [type, value] = props.attributeId.split(':');
  const { isFollowEnabled, followed, onFollow } = props;

  return (
    <Card.Root>
      <Card.Section>
        <PropertyColumns>
          <Form.Layout.Label title={'Link type'}>
            <div>
              <UserTypeTag>{startCase(type)}</UserTypeTag>
            </div>
          </Form.Layout.Label>
          <Form.Layout.Label title={'Link Value'}>{value}</Form.Layout.Label>
        </PropertyColumns>
        {!followed.includes(props.attributeId) && isFollowEnabled && (
          <Button type="SECONDARY" onClick={() => onFollow(props.attributeId)}>
            Follow
          </Button>
        )}
      </Card.Section>
    </Card.Root>
  );
};
