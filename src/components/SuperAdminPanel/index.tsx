import { Alert, Form, Modal, Select } from 'antd';
import React, { useEffect, useState } from 'react';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import {
  AsyncResource,
  failed,
  init,
  isFailed,
  isLoading,
  isSuccess,
  loading,
  match,
  success,
} from '@/utils/asyncResource';
import { Tenant } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';

export default function SuperAdminPanel() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const user = useAuth0User();

  const [tenantsRes, setTenantsRes] = useState<AsyncResource<Tenant[]>>(init());

  const api = useApi();
  useEffect(() => {
    async function fetch() {
      setTenantsRes(loading());
      try {
        const tenants = await api.getTenantsList();
        setTenantsRes(success(tenants));
      } catch (e) {
        setTenantsRes(failed(e instanceof Error ? e.message : 'Unknown error'));
      }
    }
    fetch().catch((e) => {
      console.log('e', e);
    });
  }, [api]);

  const [changeTenantRes, setChangeTenantRes] = useState<AsyncResource<void>>(init());

  const handleChangeTenant = async (data: { currentTenantId: string }) => {
    setChangeTenantRes(loading());
    try {
      await api.accountsChangeTenant({
        userId: user.userId,
        ChangeTenantPayload: {
          newTenantId: data.currentTenantId,
        },
      });
      setChangeTenantRes(success(undefined));
      window.location.reload();
    } catch (e) {
      setChangeTenantRes(failed(e instanceof Error ? e.message : 'Unknown error'));
    }
  };
  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const options = match(tenantsRes, {
    init: () => [],
    success: (value) =>
      value.map(({ id, name }) => ({
        value: id,
        label: name,
      })),
    loading: () => [{ value: '', label: `Loading...` }],
    failed: (message) => [{ value: '', label: `Unable to load tenant list: ${message}` }],
  });

  return (
    <>
      <Button type="default" size="small" onClick={showModal}>
        Super Admin
      </Button>
      <Modal
        title="Super Admin Panel"
        footer={null}
        visible={isModalVisible}
        onCancel={handleCancel}
      >
        <Form<{ currentTenantId: string }>
          name="basic"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          onValuesChange={() => {}}
          initialValues={{ currentTenantId: user.tenantId }}
          onFinish={handleChangeTenant}
          autoComplete="off"
        >
          <Form.Item label="Current tenant">
            <b>{options.find(({ value }) => value === user.tenantId)?.label ?? user.tenantId}</b>
          </Form.Item>
          <Form.Item label="Change to" name="currentTenantId">
            <Select disabled={!isSuccess(tenantsRes)} options={options} />
          </Form.Item>
          <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
            <Button type="primary" htmlType="submit" disabled={isLoading(changeTenantRes)}>
              Save
            </Button>
          </Form.Item>
          {isFailed(changeTenantRes) && <Alert message={changeTenantRes.message} type="error" />}
        </Form>
      </Modal>
    </>
  );
}
