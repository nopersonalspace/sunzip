module.exports = {
  globals: {
    // Allow for self to be a mirror of window
    self: true,
  },
  parser: "@typescript-eslint/parser",
  extends: [
    "airbnb-base",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended",
    "plugin:jsdoc/recommended",
    "plugin:eslint-comments/recommended",
    "prettier",
  ],
  env: {
    browser: true,
    node: true,
    es6: true,
    mocha: true,
  },
  plugins: [
    "import",
    "@typescript-eslint",
    "jsdoc",
    "simple-import-sort",
    "unicorn",
    "mocha",
  ],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  rules: {
    // //////// //
    // Disabled //
    // //////// //

    /** Handled by prettier */
    "comma-dangle": 0,
    "operator-linebreak": 0,
    "implicit-arrow-linebreak": 0,
    "@typescript-eslint/indent": 0,
    "object-curly-newline": 0,
    "template-curly-spacing": 0,
    "newline-per-chained-call": 0,
    "generator-star-spacing": 0,
    "computed-property-spacing": 0,
    "space-before-function-paren": 0,
    indent: 0,
    "function-paren-newline": 0,
    "no-confusing-arrow": 0,
    "no-multi-spaces": 0,
    "object-property-newline": 0,
    "brace-style": 0,
    "no-nested-ternary": 0,

    /** no types required because typescript */
    "jsdoc/require-returns-type": 0,
    "jsdoc/require-param-type": 0,

    /** handled by no-restricted-syntax */
    "guard-for-in": 0,

    /**
     * Use types instead of interfaces
     */
    "@typescript-eslint/prefer-interface": 0,
    "@typescript-eslint/interface-name-prefix": 0,
    // when we do use interfaces, they are often empty
    "@typescript-eslint/no-empty-interface": 0,

    /** Use import lint rules */
    "@typescript-eslint/no-var-requires": 0,

    /** No types required in some places, because of typescript */
    "react/prop-types": 0,
    "react/jsx-sort-props": 0,
    "react/require-default-props": 0,

    /** Because of @typescript-eslint, we don't need these */
    "no-use-before-define": 0,
    "no-shadow": 0,
    camelcase: 0,
    "no-var-requires": 0,
    "no-inferrable-types": 0,
    "unicorn/explicit-length-check": "error",

    "no-underscore-dangle": "off",
    "no-useless-constructor": 0,

    /** Bad import rules, ignore them */
    "import/no-named-as-default": 0,
    "import/extensions": 0,
    "import/prefer-default-export": 0,

    // ///// //
    // Rules //
    // ///// //

    /** Use === instead of == */
    eqeqeq: ["error"],

    /**
     * Require class methods to call this
     */
    "class-methods-use-this": ["error"],

    /**
     * @typescript-eslint rules
     */
    "@typescript-eslint/unified-signatures": ["error"],
    "@typescript-eslint/adjacent-overload-signatures": ["error"],
    "@typescript-eslint/explicit-function-return-type": [
      "error",
      { allowExpressions: true },
    ],
    "@typescript-eslint/explicit-module-boundary-types": 0,

    /** Import validation */
    "import/imports-first": ["error"],
    "import/newline-after-import": ["error"],
    "import/no-dynamic-require": ["error"],
    "import/no-unresolved": ["error"],
    "import/no-webpack-loader-syntax": ["error"],

    /**
     * No console logs anywhere.
     */
    "no-console": ["error"],

    /** Use template strings for concatenation */
    "prefer-template": ["error"],

    /**
     * Limits on file size and line length, for readability
     */
    "max-len": ["error", 150, { comments: 150 }],

    /** Require curly brackets around newlines */
    curly: ["error"],

    /** Ensure eslint-disable is not present when its not disabling any rule */
    "eslint-comments/no-unused-disable": ["error"],

    /** Arrow functions should have parentheses around inputs */
    "arrow-parens": ["error", "always"],
    "arrow-body-style": ["error", "as-needed"],

    /** Max lines in a file */
    "max-lines": ["error", 350],

    /** Generator functions should call `yield` */
    "require-yield": ["error"],

    /** Prefer for-of to for loop */
    "@typescript-eslint/prefer-for-of": ["error"],

    /** Should not alias this to another command */
    "@typescript-eslint/no-this-alias": ["error"],

    /** Prevent use of global variables */
    "no-restricted-globals": ["error"],

    /** No unnecessary async statements on a function */
    "require-await": ["error"],

    /**
     * If there are more than 4 arguments in a function, it should be refactored
     * to have fewer arguments. The easiest way of doing this is to create an
     * "options" parameter that holds all of the missing parameters
     * @see https://eslint.org/docs/rules/max-params
     */
    "max-params": ["error", 4],

    /**
     * Sort imports
     * @see https://github.com/lydell/eslint-plugin-simple-import-sort
     */
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",

    // No unused imports or variables. Convenient for pre-commit hook.
    "@typescript-eslint/no-unused-vars": 2,

    // JSdoc Rules
    "jsdoc/require-jsdoc": [
      "error",
      {
        require: {
          ArrowFunctionExpression: false,
          ClassDeclaration: true,
          ClassExpression: true,
          FunctionDeclaration: true,
          FunctionExpression: true,
          MethodDefinition: true,
        },
        contexts: [
          {
            context: "TSPropertySignature",
            inlineCommentBlock: true,
          },
          "TSEnumDeclaration",
          "TSTypeAliasDeclaration",
          "FunctionDeclaration",
          "ClassDeclaration",
        ],
      },
    ],
    "jsdoc/check-types": ["error"],
    "jsdoc/check-param-names": ["error", { checkDestructured: false }],
    "jsdoc/require-returns": ["error"],
    "jsdoc/no-types": ["error"],
    "jsdoc/require-param": ["error", { checkDestructured: false }],
    "jsdoc/require-param-description": ["error"],
    "jsdoc/require-returns-description": ["error"],
    "jsdoc/require-hyphen-before-param-description": ["error"],
    "jsdoc/require-description": [
      "error",
      {
        contexts: [
          "TSPropertySignature",
          "TSEnumDeclaration",
          "TSTypeAliasDeclaration",
          "FunctionDeclaration",
          "ClassDeclaration",
        ],
      },
    ],

    // //////// //
    // Warnings //
    // //////// //

    /** We want to eventually turn this to an error */
    "@typescript-eslint/ban-types": ["warn"],

    /** eslint-config-preact overrides */
    "constructor-super": "off",
    "no-redeclare": "off",
    "no-duplicate-imports": "off",
    "no-undef": "off",
    "no-dupe-class-members": "off",
    "no-unused-vars": "off", // we already have this covered by typescript-eslint config
    "no-empty": ["error"],
    "no-empty-pattern": ["error"],
    "react/display-name": "off",

    "mocha/no-skipped-tests": "error",
    "mocha/no-exclusive-tests": "error",
  },
  overrides: [
    /**
     * Javascript files can ignore type requirements
     */
    {
      files: ["*.js", "*.mjs"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": 0,
      },
    },
    /**
     * In test files, we allow them to be a bit longer
     */
    {
      files: ["**/*.spec.ts", "**/tests/helpers/*"],
      rules: {
        "no-unused-expressions": 0,
        // Give a bit more leeway in test files
        "max-lines": ["warn", 450],
        "jsdoc/require-jsdoc": 0,
        "import/no-extraneous-dependencies": [
          "error",
          {
            devDependencies: true,
            optionalDependencies: false,
            peerDependencies: false,
          },
        ],
      },
    },
    {
      files: ["*.ts"],
      rules: {
        "simple-import-sort/imports": [
          "error",
          {
            groups: [
              // Side effect imports.
              ["^\\u0000"],
              // Anything not matched in another group.
              ["^"],
              // Relative imports.
              ["^\\."],
            ],
          },
        ],
      },
    },
  ],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    /** Allow typescript alias resolution */
    "import/resolver": {
      typescript: {},
      project: "tsconfig.json",
    },
  },
};
