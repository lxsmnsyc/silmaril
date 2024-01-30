import type * as babel from '@babel/core';
import type * as t from '@babel/types';

export interface NamedImportDefinition {
  kind: 'named';
  name: string;
  source: string;
}

export interface DefaultImportDefinition {
  kind: 'default';
  source: string;
}

export type ImportDefinition = DefaultImportDefinition | NamedImportDefinition;

export interface StateContext {
  imports: Map<string, t.Identifier>;
  registrations: {
    identifiers: Map<t.Identifier, ImportDefinition>;
    namespaces: Map<t.Identifier, ImportDefinition[]>;
  };
}

export interface CodeOutput {
  code: babel.BabelFileResult['code'];
  map: babel.BabelFileResult['map'];
}
