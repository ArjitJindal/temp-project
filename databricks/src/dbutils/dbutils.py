# pylint: skip-file
# get_dbutils enables us to refer to the Databrick's runtime without pylint and mypy complaining too much.
# https://stackoverflow.com/questions/50813493/nameerror-name-dbutils-is-not-defined-in-pyspark
def get_dbutils(spark):
    try:
        from pyspark.dbutils import DBUtils  # type: ignore[import-not-found]

        dbutils = DBUtils(spark)
    except ImportError:
        import IPython  # type: ignore[import-not-found]

        dbutils = IPython.get_ipython().user_ns["dbutils"]
    return dbutils
