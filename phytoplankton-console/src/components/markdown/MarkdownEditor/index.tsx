import React, { Component, createRef } from 'react';
import '@toast-ui/editor/dist/toastui-editor.css';
import '../shared-styles.less';
import { ToolbarItemOptions } from '@toast-ui/editor/types/ui';
import { mentionRegex } from '@flagright/lib/constants';
import s from './styles.module.less';
import { getNode } from './mention-utlis';
import { makeAsyncComponent } from '@/utils/imports';

const Editor = makeAsyncComponent(async () => {
  const mod = await import('@toast-ui/react-editor');
  const ToastEditor = mod.Editor;

  return {
    default: React.forwardRef<any, any>((props, ref) => <ToastEditor {...props} ref={ref} />),
  };
});

export interface MentionItem {
  id: string;
  label: string;
}
interface Props {
  initialValue: string;
  placeholder?: string;
  onAttachFiles?: () => void;
  onChange: (value: string) => void;
  mentionsEnabled?: boolean;
  mentionsList?: Array<MentionItem>;
  editorHeight?: number | 'FULL';
  onDropFiles?: (files: File[]) => void;
}

export default class MarkdownEditor extends Component<Props> {
  editorRef = createRef<any>();
  rootRef = createRef<HTMLDivElement>();

  private toolbarItems: (string | ToolbarItemOptions)[][] = [];

  reset() {
    this.editorRef.current?.getInstance()?.reset();
  }

  node(searchPhrase: string) {
    const node = getNode(searchPhrase, this.props.mentionsList);

    node.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLDivElement;
      const id = this.props.mentionsList?.find(
        (mentionItem) => mentionItem.label === target.id,
      )?.id;
      if (!id) {
        return;
      }
      this.insertMention({ id: id, label: target.id }, searchPhrase);
      node.remove();
    });

    return node;
  }

  constructor(props: Props) {
    super(props);
    this.toolbarItems = [
      ['bold', 'italic', 'strike'],
      ['link'],
      ['ul', 'ol'],
      ['code', 'codeblock'],
      this.props.onAttachFiles != null
        ? [
            {
              name: 'attach_file',
              el: createToolButton(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="${s.attach}">
                        <g>
                          <path fill="currentColor" d="M14 13.5V8a4 4 0 1 0-8 0v5.5a6.5 6.5 0 1 0 13 0V4h2v9.5a8.5 8.5 0 1 1-17 0V8a6 6 0 1 1 12 0v5.5a3.5 3.5 0 0 1-7 0V8h2v5.5a1.5 1.5 0 0 0 3 0z"/>
                        </g>
                       </svg>`,
                this.props.onAttachFiles,
              ),
              command: `attach`,
              tooltip: 'Attach file',
            },
          ]
        : [],
    ];
  }

  insertMention = (mentionItem: MentionItem, searchPhrase) => {
    const editor = this.editorRef.current?.getInstance();
    if (editor) {
      const [start, end] = editor.getSelection();
      const label = mentionItem.label.split('@')[0];
      editor.replaceSelection(
        `[@${label}](${mentionItem.id}) `,
        (start as number) - searchPhrase.length - 1,
        end as number,
      );
    }
  };

  handlePressEnter(searchPhrase) {
    const reducedSearchPhrase = searchPhrase.substring(0, searchPhrase.length - 2);
    const users =
      this.props.mentionsList?.filter((mentionItem) =>
        mentionItem.label.startsWith(reducedSearchPhrase),
      ) ?? [];
    if (users.length > 0) {
      this.insertMention(users[0], searchPhrase);
    }
  }

  handleMention(key: string) {
    if (!this.props.mentionsEnabled) {
      return;
    }
    const text = this.editorRef.current?.getInstance()?.getMarkdown() ?? '';
    const cursorPos: number = this.editorRef.current?.getInstance()?.getSelection()[1] as number;
    let cursorIndex = cursorPos - 1;
    const mentionRegexMatchesCount = (text.substring(0, cursorIndex).match(mentionRegex) || [])
      .length;

    cursorIndex -= mentionRegexMatchesCount * 2 + 1;
    let mentionStartIndex = -1;

    // Finding the start index of the partial mention
    for (let i = cursorIndex; i >= 0; i--) {
      if (text[i] === '@' || text[i] === ' ') {
        mentionStartIndex = i;
        break;
      }
    }

    const partialMention = text.substring(mentionStartIndex, cursorIndex + 1);

    // Handling mentions based on key events and partial mention
    if (key === '@' || partialMention.startsWith('@')) {
      const partialUsername = partialMention.substring(1);
      if (key === 'Enter' && partialUsername.length) {
        this.handlePressEnter(partialUsername);
      } else {
        const mentionNode = this.node(partialUsername.toLowerCase());
        this.editorRef.current?.getInstance()?.addWidget(mentionNode, 'bottom');
      }
    }
  }

  handleImageBlobHook = (blob: File | Blob) => {
    if (this.props.onDropFiles && blob instanceof File) {
      const isImage = blob.type.startsWith('image/');
      if (isImage) {
        this.props.onDropFiles([blob]);
      }
    }
    return false;
  };

  render() {
    return (
      <div
        ref={this.rootRef}
        className={s.root}
        style={{
          minHeight: 200,
          height: this.props.editorHeight === 'FULL' ? undefined : 200,
        }}
        onPasteCapture={(e) => {
          const clipboardData = e.clipboardData;
          const html = clipboardData.getData('text/html');
          const text = clipboardData.getData('text');
          if (html !== text) {
            e.preventDefault();
            e.stopPropagation();
            window.document.execCommand('insertText', false, text);
          }
        }}
        data-cy={'comment-textbox'}
      >
        <Editor
          height={'100%'}
          hideModeSwitch={true}
          previewStyle="vertical"
          initialEditType="wysiwyg"
          initialValue={this.props.initialValue}
          ref={this.editorRef}
          toolbarItems={this.toolbarItems}
          onChange={() => {
            const editor = this.editorRef.current?.getInstance();
            if (editor) {
              this.props.onChange(editor.getMarkdown());
            }
          }}
          widgetRules={
            this.props.mentionsEnabled
              ? [
                  {
                    rule: mentionRegex,
                    toDOM: (text) => {
                      const match = mentionRegex.exec(text);
                      const span = document.createElement('span');
                      span.classList.add(s.mention);
                      span.innerText = match?.[1] ?? '';
                      return span;
                    },
                  },
                ]
              : []
          }
          hooks={{
            addImageBlobHook: this.handleImageBlobHook,
          }}
          placeholder={this.props.placeholder}
          onKeyup={this.handleMention.bind(this)}
        />
      </div>
    );
  }
}

function createToolButton(content: string, cb: () => void) {
  const button = document.createElement('button');
  button.className = `toastui-editor-toolbar-icons ${s.toolButton}`;
  button.style.backgroundImage = 'none';
  button.style.margin = '0';
  button.innerHTML = content;
  button.setAttribute('data-cy', 'attach-files-button');
  button.addEventListener('click', cb);
  return button;
}
