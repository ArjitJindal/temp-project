from pyspark.sql.types import StructType


def merge_schemas(*schemas: StructType) -> StructType:
    return StructType(list({obj.name: obj for l in schemas for obj in l}.values()))
