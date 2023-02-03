import { JSONSchema4 } from 'json-schema';

export interface UiSchema {
  'ui:subtype'?: string;
  'ui:group'?: string;
  'ui:order'?: [string];
}

export interface ExtendedSchema extends JSONSchema4 {
  'ui:schema'?: UiSchema;
}

// todo: fix any?
export type FormValues = Record<string, any>;

export type PropertyItem = {
  name: string;
  isRequired: boolean;
  schema: ExtendedSchema;
};
export type PropertyItems = PropertyItem[];
