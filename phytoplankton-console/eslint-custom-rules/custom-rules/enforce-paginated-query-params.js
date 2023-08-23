module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce correct parameter type for queryFn in usePaginatedQuery',
      category: 'TypeScript',
      recommended: true,
    },
    schema: [],
  },
  create(context) {
    return {
      'CallExpression[callee.name="usePaginatedQuery"]'(node) {
        const queryFnArg = node.arguments[1];

        if (queryFnArg) {
          const params = queryFnArg.params;

          if (params.length !== 1) {
            context.report({
              node: params[0] || queryFnArg,
              message: 'Expected `paginationParams` to be used in `queryFn`',
            });
          }
        }
      },
    };
  },
};
