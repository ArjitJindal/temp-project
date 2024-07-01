import os

import boto3


def read_file_from_s3(file_key):
    s3 = boto3.client("s3")
    obj = s3.get_object(Bucket=os.environ["DATALAKE_BUCKET"], Key=file_key)
    file_content = obj["Body"].read().decode("utf-8")  # decoding from bytes to string
    return file_content


def write_file_to_s3(file_key, content):
    s3 = boto3.client("s3")
    s3.put_object(Bucket=os.environ["DATALAKE_BUCKET"], Key=file_key, Body=content)


def checkpoint_dir(path: str):
    return file(f"checkpoints/{path}")


def file(filepath: str):
    bucket = os.environ["DATALAKE_BUCKET"]
    return f"s3://{bucket}/{filepath}"
