export default {
  meta: { type: "problem", schema: [] },
  create(context) {
    return {
      Program() {
        if (!context.filename.split("/").includes("__tests__")) {
          context.report({
            loc: { line: 1, column: 0 },
            message: "Test files must live inside a __tests__/ folder.",
          });
        }
      },
    };
  },
};
