import json
import sys
from enum import Enum

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.iam import ComplexValue, AccessControlRequest, PermissionLevel
import boto3
from botocore.exceptions import ClientError
import os

sys.path.append(os.path.abspath("/Workspace/Shared/main"))

from databricks.sdk.runtime import *

from src.entities import entities

workspace_access = ComplexValue()
workspace_access.value = "workspace-access"
workspace_access.display = "workspace-access"

sql_access = ComplexValue()
sql_access.value = "databricks-sql-access"
sql_access.display = "databricks-sql-access"


def create_or_update_secret(secret_name, secret_value):
    # Initialize a client for AWS Secrets Manager
    client = boto3.client('secretsmanager', region_name=os.environ["AWS_REGION"])

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


w = WorkspaceClient(
    auth_type="pat",
    token=dbutils.secrets.get('databricks', 'token'),
    host=spark.conf.get("spark.databricks.workspaceUrl")
)

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

print(f"querying integrated tenants")
tenants_query = w.statement_execution.execute_statement(
    'select distinct(tenant) from hive_metastore.default.transactions',
    warehouse_id)

tenants = []
if tenants_query.result is not None:
    tenants = [result[0] for result in tenants_query.result.data_array]
for tenant in tenants:
    if tenant not in principals:
        print(f"creating service principal for {tenant}")
        sp = w.service_principals.create(active=True, display_name=tenant, entitlements=[workspace_access, sql_access])

print("setting permissions for all service principals")
all_principals = [sp for sp in w.service_principals.list()]
sp_perms = []
for sp in all_principals:
    acr = AccessControlRequest()
    acr.service_principal_name = sp.application_id
    acr.permission_level = PermissionLevel.CAN_USE
    sp_perms.append(acr)

adm = AccessControlRequest()
adm.group_name = "admins"
adm.permission_level = PermissionLevel.CAN_MANAGE

sp_perms.append(adm)

w.permissions.set("authorization", "tokens", access_control_list=sp_perms)
w.permissions.set("sql/warehouses", warehouse_id, access_control_list=sp_perms)
print("permissions set")

print("reconfiguring all service principals")
for sp in all_principals:
    tenant = sp.display_name
    print(f"configure {tenant}")

    if sp.display_name not in tenants:
        print(tenants.result.data_array)
        continue
    w.service_principals.update(sp.id, display_name=sp.display_name, entitlements=[workspace_access, sql_access])

    print(f"creating schema for {tenant}")
    w.statement_execution.execute_statement(f"create schema hive_metastore.{tenant}", warehouse_id)
    w.statement_execution.execute_statement(f"grant usage on schema hive_metastore.{tenant} to `{sp.application_id}`",
                                            warehouse_id)

    print("creating missing views")
    query_result = w.statement_execution.execute_statement(f"show tables in {tenant}", warehouse_id)
    if query_result.result is None:
        tables = []
    else:
        tables = [table[1] for table in query_result.result.data_array]

    for entity in entities:
        table = entity["table"]
        if table not in tables:
            print(f"create view {table} for {tenant}")
            r = w.statement_execution.execute_statement(
                f"create view hive_metastore.{tenant}.{table} as select * from hive_metastore.default.{table} where tenant = '{tenant}'",
                warehouse_id)

    for entity in entities:
        table = entity["table"]
        w.statement_execution.execute_statement(
            f"grant select on view hive_metastore.{tenant}.{table} to `{sp.application_id}`", warehouse_id)

    print(f"creating token for {tenant} service principal")
    token = w.token_management.create_obo_token(sp.application_id, -1)

    print(f"pushing secret to AWS")
    create_or_update_secret(f"databricks/{tenant}", json.dumps({
        "token": token.token_value,
        "host": warehouse.odbc_params.hostname,
        "path": warehouse.odbc_params.path
    }))
