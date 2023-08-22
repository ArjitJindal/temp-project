import Widget from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title="Basic case">
        <Widget id="test" title={'Test title'}>
          Content
        </Widget>
      </UseCase>
      <UseCase title="With download button">
        <Widget
          id="test"
          title={'Test title'}
          onDownload={async () => {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                if (Math.random() < 0.2) {
                  resolve({
                    fileName: 'test.txt',
                    data: 'file content here...',
                  });
                } else {
                  reject('This is just a test of a faling download');
                }
              }, 1000 + Math.round(Math.random() * 2000));
            });
          }}
        >
          Content
        </Widget>
      </UseCase>
    </>
  );
}
