/* eslint-disable import/no-extraneous-dependencies */
import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import includePaths from "rollup-plugin-includepaths";

/* eslint-enable import/no-extraneous-dependencies */
// const name = require('./package.json').main.replace(/\.js$/, '')
import packageJson from "./package.json" assert { type: "json" };

const includePathOptions = {
  include: {},
  paths: ["src/lib"],
  external: [],
  extensions: [".js", ".json", ".html"],
};

const name = packageJson.main.replace(/\.js$/, "");

const bundle = (config) => ({
  ...config,
  input: "src/index.ts",
  external: (id) => !/^[./]/.test(id),
});

export default [
  bundle({
    plugins: [esbuild(), includePaths(includePathOptions)],
    output: [
      {
        file: `${name}.js`,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: `${name}.mjs`,
        format: "es",
        sourcemap: true,
      },
    ],
  }),
  bundle({
    plugins: [dts(), includePaths(includePathOptions)],
    output: {
      file: `${name}.d.ts`,
      format: "es",
    },
  }),
];
