import Dragger from 'antd/lib/upload/Dragger';
import { InboxOutlined } from '@ant-design/icons';
import s from './style.module.less';
import { sleep } from '@/utils/time-utils';

export function AttachmentsStep() {
  return (
    <div className={s.root}>
      <Dragger
        key="import"
        showUploadList={true}
        multiple={true}
        action="https://run.mocky.io/v3/72da4925-9447-4ea7-8bf8-841bc4330646"
        customRequest={async ({ onSuccess, onProgress }) => {
          for (let i = 1; i <= 100; i += 1) {
            await sleep(Math.random() * 50);
            onProgress!({ percent: i });
          }
          onSuccess!('OK');
        }}
      >
        <div style={{ padding: 20 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            <div>Click or drag file to this area to upload</div>
            <div>
              Support for a single or bulk upload. Strictly prohibit from uploading company data or
              other related files.
            </div>
          </p>
        </div>
      </Dragger>
    </div>
  );
}
