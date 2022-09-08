/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useApi } from '@backstage/core-plugin-api';
import { Button } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import { last, omit } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { configAsDataApiRef } from '../../../../../apis';
import { Function } from '../../../../../types/Function';
import {
  Kptfile,
  KptfileFunction,
  KptfileMetadata,
} from '../../../../../types/Kptfile';
import {
  isMutatorFunction,
  isValidatorFunction,
} from '../../../../../utils/function';
import { PackageResource } from '../../../../../utils/packageRevisionResources';
import { dumpYaml, loadYaml } from '../../../../../utils/yaml';
import {
  ResourceMetadataAccordion,
  SingleTextFieldAccordion,
} from '../Controls';
import { useEditorStyles } from '../styles';
import { KptFunctionEditorAccordion } from './components/KptFunctionEditorAccordion';

type OnUpdatedYamlFn = (yaml: string) => void;

type KptfileEditorProps = {
  yaml: string;
  onUpdatedYaml: OnUpdatedYamlFn;
  packageResources: PackageResource[];
};

type State = {
  metadata: KptfileMetadata;
  description: string;
};

export type KptfileFunctionView = KptfileFunction & {
  key: number;
};

export const KptfileEditor = ({
  yaml,
  onUpdatedYaml,
  packageResources,
}: KptfileEditorProps) => {
  const resourceYaml = loadYaml(yaml) as Kptfile;
  const api = useApi(configAsDataApiRef);

  const createResourceState = (): State => ({
    metadata: resourceYaml.metadata,
    description: resourceYaml.info?.description || '',
  });

  const createFunctionsView = (
    kptFunctions: KptfileFunction[],
  ): KptfileFunctionView[] => {
    const mapToView = (
      fn: KptfileFunction,
      index: number,
    ): KptfileFunctionView => ({ ...fn, key: index });

    return kptFunctions.map(mapToView);
  };

  const [state, setState] = useState<State>(createResourceState());
  const [mutators, setMutators] = useState<KptfileFunctionView[]>(
    createFunctionsView(resourceYaml.pipeline?.mutators ?? []),
  );
  const [validators, setValidators] = useState<KptfileFunctionView[]>(
    createFunctionsView(resourceYaml.pipeline?.validators ?? []),
  );
  const [allKptFunctions, setAllKptFunctions] = useState<Function[]>([]);

  const allKptMutatorFunctions = useMemo(
    () => allKptFunctions.filter(isMutatorFunction),
    [allKptFunctions],
  );
  const allKptValidatorFunctions = useMemo(
    () => allKptFunctions.filter(isValidatorFunction),
    [allKptFunctions],
  );

  const [expanded, setExpanded] = useState<string>();

  const classes = useEditorStyles();

  useAsync(async (): Promise<void> => {
    const allFunctions = await api.listCatalogFunctions();
    setAllKptFunctions(allFunctions);
  }, []);

  useEffect(() => {
    const mapToKptFunction = (fn: KptfileFunctionView): KptfileFunction => {
      const thisFn = omit(fn, 'key');
      return thisFn;
    };

    if (!resourceYaml.pipeline) resourceYaml.pipeline = {};

    resourceYaml.metadata = state.metadata;
    resourceYaml.info.description = state.description;
    resourceYaml.pipeline.mutators =
      mutators.length > 0 ? mutators.map(mapToKptFunction) : undefined;
    resourceYaml.pipeline.validators =
      validators.length > 0 ? validators.map(mapToKptFunction) : undefined;

    onUpdatedYaml(dumpYaml(resourceYaml));
  }, [state, mutators, validators, resourceYaml, onUpdatedYaml]);

  const kptFunctionUpdateFn = (
    lst: KptfileFunctionView[],
    setFunctions: React.Dispatch<React.SetStateAction<KptfileFunctionView[]>>,
    currentFunction: KptfileFunctionView,
    updatedFunction?: KptfileFunctionView,
  ) => {
    const idx = lst.indexOf(currentFunction);
    const updatedList = lst.slice();
    if (updatedFunction) {
      updatedList[idx] = updatedFunction;
    } else {
      updatedList.splice(idx, 1);
    }
    setFunctions(updatedList);
  };

  const updateMutatorFunction = (
    currentFunction: KptfileFunctionView,
    updatedFunction?: KptfileFunctionView,
  ): void => {
    kptFunctionUpdateFn(
      mutators,
      setMutators,
      currentFunction,
      updatedFunction,
    );
  };

  const updateValidatorFunction = (
    currentFunction: KptfileFunctionView,
    updatedFunction?: KptfileFunctionView,
  ): void => {
    kptFunctionUpdateFn(
      validators,
      setValidators,
      currentFunction,
      updatedFunction,
    );
  };

  return (
    <div className={classes.root}>
      <ResourceMetadataAccordion
        clusterScopedResource
        id="metadata"
        state={[expanded, setExpanded]}
        value={state.metadata}
        onUpdate={metadata => setState(s => ({ ...s, metadata }))}
      />

      <SingleTextFieldAccordion
        id="package-description"
        title="Package Description"
        state={[expanded, setExpanded]}
        value={state.description}
        onValueUpdated={value => setState(s => ({ ...s, description: value }))}
      />

      {mutators.map(fn => (
        <KptFunctionEditorAccordion
          id={`mutator-${fn.key}`}
          key={`mutator-${fn.key}`}
          title="Mutator"
          state={[expanded, setExpanded]}
          kptFunction={fn}
          allKptFunctions={allKptMutatorFunctions}
          packageResources={packageResources}
          onUpdatedKptFunction={updateMutatorFunction}
        />
      ))}

      {validators.map(fn => (
        <KptFunctionEditorAccordion
          id={`validator-${fn.key}`}
          key={`validator-${fn.key}`}
          title="Validator"
          state={[expanded, setExpanded]}
          kptFunction={fn}
          allKptFunctions={allKptValidatorFunctions}
          packageResources={packageResources}
          onUpdatedKptFunction={updateValidatorFunction}
        />
      ))}

      <div className={classes.buttonRow}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            const nextKey = (last(mutators)?.key || 0) + 1;
            setMutators([...mutators, { image: '', key: nextKey }]);
            setExpanded(`mutator-${nextKey}`);
          }}
        >
          Add Mutator
        </Button>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            const nextKey = (last(validators)?.key || 0) + 1;
            setValidators([...validators, { image: '', key: nextKey }]);
            setExpanded(`validator-${nextKey}`);
          }}
        >
          Add Validator
        </Button>
      </div>
    </div>
  );
};
