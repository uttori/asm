import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import antiTrojanSource from "eslint-plugin-anti-trojan-source";
import globals from "globals";
import importPlugin from 'eslint-plugin-import';
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import n from "eslint-plugin-n";
import optimizeRegex from "eslint-plugin-optimize-regex";
import path from "node:path";
import security from "eslint-plugin-security";
import stylistic from '@stylistic/eslint-plugin';
import tsParser from "@typescript-eslint/parser";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import xss from "eslint-plugin-xss";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [
  n.configs["flat/recommended-script"],
  jsdoc.configs['flat/recommended-typescript-flavor'],
  ...compat.extends(
    "plugin:optimize-regex/all",
    "plugin:@typescript-eslint/recommended-type-checked",
  ),
  {
    ignores: ['**/node_modules'],
    plugins: {
      '@stylistic': stylistic,
      "@typescript-eslint": typescriptEslint,
      "anti-trojan-source": antiTrojanSource,
      "optimize-regex": optimizeRegex,
      import: importPlugin,
      security,
      xss,
    },

    files: ["**/*.{js,mjs,cjs,ts,mts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        project: ['./tsconfig.json'],
        requireConfigFile: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        typescript: {
          // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
          alwaysTryTypes: true,
          // use an array of glob patterns
          project: ['./tsconfig.json'],
        },
      },
      jsdoc: {
        mode: "typescript",
      },
      react: {
        version: "detect",
      },
    },

    rules: {
      ...importPlugin.configs.recommended.rules,
      ...security.configs.recommended.rules,

      '@stylistic/dot-location': ['warn', 'property'],
      '@stylistic/new-parens': 'warn',
      '@stylistic/no-mixed-operators': [
        'warn',
        {
          groups: [
            ['&', '|', '^', '~', '<<', '>>', '>>>'],
            ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
            ['&&', '||'],
            ['in', 'instanceof'],
          ],
          allowSamePrecedence: false,
        },
      ],
      '@stylistic/no-whitespace-before-property': 'warn',
      '@stylistic/quotes': [
        'error',
        'double',
        {
          avoidEscape: true,
        },
      ],
      '@stylistic/rest-spread-spacing': ['warn', 'never'],

      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unused-vars": ["error", {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrors: "none",
      }],

      "anti-trojan-source/no-bidi": "error",
      camelcase: 0,

      "consistent-return": ["warn", {
          treatUndefinedAsUnspecified: false,
      }],
      "jsdoc/no-undefined-types": 1,

      "no-empty": ["error", {
          allowEmptyCatch: true,
      }],

      "no-param-reassign": 0,
      "no-plusplus": 0,

      "no-restricted-syntax": ["error", {
          selector: "ForInStatement",
          message: "for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.",
      }, {
          selector: "LabeledStatement",
          message: "Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.",
      }, {
          selector: "WithStatement",
          message: "`with` is disallowed in strict mode because it makes code impossible to predict and optimize.",
      }],

      "no-underscore-dangle": 0,

      "no-unused-vars": 0,

      "n/no-missing-import": ["error", {
          allowModules: ["ava"],
      }],

      "n/no-unsupported-features/es-syntax": ["error", {
          ignores: ["modules", "dynamicImport"],
      }],

      "optimize-regex/optimize-regex": "warn",
      "security/detect-non-literal-fs-filename": 0,
      "security/detect-non-literal-require": 0,
      "security/detect-object-injection": 0,
    },
  },
];
