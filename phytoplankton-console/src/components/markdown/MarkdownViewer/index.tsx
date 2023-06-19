import '@toast-ui/editor/dist/toastui-editor.css';
import { Viewer } from '@toast-ui/react-editor';
import React from 'react';
import '../shared-styles.less';

interface Props {
  value: string;
}

export default class MarkdownViewer extends React.Component<Props> {
  editorRef = React.createRef<Viewer>();

  render() {
    return <Viewer initialValue={this.props.value} ref={this.editorRef} usageStatistics={false} />;
  }
}
