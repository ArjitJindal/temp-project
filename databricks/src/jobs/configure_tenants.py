import json
import sys
import os
from databricks.sdk import WorkspaceClient, AccountClient
from databricks.sdk.service.iam import WorkspacePermission,ComplexValue
import boto3
from botocore.exceptions import ClientError

sys.path.append(os.path.abspath("/Workspace/Shared/main"))

from databricks.sdk.runtime import *

from src.entities import entities

def create_or_update_secret(secret_name, secret_value):
  # Initialize a client for AWS Secrets Manager
  client = boto3.client('secretsmanager')

  try:
    # Check if the secret already exists
    client.describe_secret(SecretId=secret_name)
    secret_exists = True
  except ClientError as e:
    if e.response['Error']['Code'] == 'ResourceNotFoundException':
      secret_exists = False
    else:
      raise e  # Reraise the exception if it's not a 'ResourceNotFoundException'

  # Create a new secret or update the existing one
  if secret_exists:
    print(f"Updating secret: {secret_name}")
    client.update_secret(SecretId=secret_name, SecretString=secret_value)
  else:
    print(f"Creating new secret: {secret_name}")
    client.create_secret(Name=secret_name, SecretString=secret_value)

  print("Operation completed successfully.")


w = WorkspaceClient()

print(f"querying existing principals")
all_principals = [sp for sp in w.service_principals.list()]

print(f"existing principals {all_principals}")

principals = {sp.display_name: sp.application_id for sp in all_principals}

warehouse_id = None
warehouse = None
for wh in w.warehouses.list():
  if wh.name == "tarpon":
    warehouse_id = wh.id
    warehouse = wh


# Toggle this to rotate all secrets
rotate_secrets = False
if rotate_secrets:
  print("rotating secrets")
  for sp in all_principals:
    tenant = sp.display_name
    print(f"creating token for {tenant} service principal")
    token = w.token_management.create_obo_token(sp.application_id, -1)

    print(f"pushing secret to AWS")
    create_or_update_secret(f"databricks/{tenant}", json.dumps({
      "token": token.token_value,
      "host": warehouse.odbc_params.hostname,
      "path": warehouse.odbc_params.path
    }))

print(f"querying integrated tenants")
tenants = w.statement_execution.execute_statement('select distinct(tenant) from hive_metastore.default.transactions', warehouse_id)

for [tenant] in tenants.result.data_array:
  if tenant not in principals:
    print(f"creating service principal for {tenant}")

    workspace_access = ComplexValue()
    workspace_access.value = "workspace-access"
    workspace_access.display = "workspace-access"

    sql_access = ComplexValue()
    sql_access.value = "databricks-sql-access"
    sql_access.display = "databricks-sql-access"

    sp = w.service_principals.create(active=True, display_name=tenant, entitlements=[workspace_access, sql_access])

    w.service_principals.update(sp.id, display_name=sp.display_name, entitlements=[workspace_access, sql_access])

    print(f"creating token for {tenant} service principal")
    token = w.token_management.create_obo_token(sp.application_id, -1)

    print(f"pushing secret to AWS")
    create_or_update_secret(f"databricks/{tenant}", json.dumps({
      "token": token.token_value,
      "host": warehouse.odbc_params.hostname,
      "path": warehouse.odbc_params.path
    }))

    print(f"creating schema for {tenant}")
    w.statement_execution.execute_statement(f"create schema hive_metastore.{tenant}", warehouse_id)
    w.statement_execution.execute_statement(f"grant select on schema hive_metastore.{tenant} to {sp.application_id}", warehouse_id)
  tables = [table[1] for table in w.statement_execution.execute_statement(f"show tables in {tenant}", warehouse_id).result.data_array]

  for entity in entities:
    table = entity["table"]
    if table not in tables:
      print(f"create view {table} for {tenant}")
      r = w.statement_execution.execute_statement(f"create view hive_metastore.{tenant}.{table} as select * from hive_metastore.default.{table} where tenant = '{tenant}'", warehouse_id)

  print(f"configured {tenant}")