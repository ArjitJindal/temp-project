# Databricks

## Installation

Ensure you have installed:

- [poetry](https://python-poetry.org/docs/)
- [python](https://www.python.org/downloads/) at 3.9.6
- [Java 11](https://www.java.com/en/download/help/download_options.html)

Then run the following to ensure everything is correctly configured:

```
make all_checks
```

## Deploy manually to stage/region

1. Refresh aws credentials

```
npm run aws-login dev
```

2. Generate `openapi` folder:

```
make generate
```

3. Deploy stack

Go to `/infra` folder and run:

```
npm run deploy [stage] [region]
```

> During the first deployment with CDKTF, the line in `main.ts` with `this.workspace` should be commented out.
