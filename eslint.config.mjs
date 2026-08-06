import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ESLint, configured explicitly rather than bootstrapped by `next lint`.
 *
 * `next lint` is deprecated in Next 15 and removed in 16, and — more urgently —
 * when it finds no ESLint configuration it *asks a question*: "How would you
 * like to configure ESLint?" On a developer's terminal that is a helpful
 * prompt. On a CI runner there is no TTY to answer it, so the process exits 1
 * with no error message that looks like a lint failure, which is exactly what
 * was happening to this workflow. The fix is to have a config at all, and to
 * call the ESLint CLI directly.
 *
 * `FlatCompat` is the bridge: `eslint-config-next` is still published in the
 * legacy `.eslintrc` shape, and ESLint 9 runs flat config. This translates one
 * to the other so the Next rules — which catch real things, like a client
 * component importing a server module — keep applying.
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  {
    // Build output, dependencies, and generated code. Linting generated Prisma
    // types produces thousands of findings about code nobody wrote.
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "next-env.d.ts",
      "src/generated/**",
      "prisma/migrations/**",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      /**
       * Unused variables are an error, with the conventional underscore escape
       * — `catch (_err)` when the failure genuinely does not matter is a
       * deliberate statement, and should not need a comment to survive lint.
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          /**
           * `const { id, weddingId, ...rest } = row` is the idiom for "copy
           * everything except these", and the omitted keys are the entire
           * point of writing it. Without this the rule demands they be renamed
           * `_id`, which reads as an unused variable rather than as a
           * deliberate exclusion.
           */
          ignoreRestSiblings: true,
        },
      ],

      /**
       * `any` is a warning, not an error.
       *
       * Two places in this codebase legitimately reach for it: Prisma's `Json`
       * columns, which have no static shape by definition, and the session
       * object, which Auth.js types as a bag. Making it an error would mean
       * either a stack of suppression comments or a worse type — and a rule
       * that gets suppressed everywhere teaches people to suppress rules.
       */
      "@typescript-eslint/no-explicit-any": "warn",

      /**
       * `console` is a warning everywhere except the logger, which is the
       * transport and says so. This is the rule that stops a debugging
       * `console.log(user)` reaching production and printing a session.
       */
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    // Tests assert on shapes that are deliberately wrong, and mock modules with
    // partial objects. Both need `any` without argument.
    files: ["tests/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off", "no-console": "off" },
  },
];
