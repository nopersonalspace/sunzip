const depcheck = require("depcheck");
const path = require("path");

const config = {
  ignorePatterns: [
    // files matching these patterns will be ignored
    "eslint-import-resolver-project",
  ],
  specials: [
    // the target special parsers
    depcheck.special.eslint,
    depcheck.special.rollup,
  ],
};

depcheck(path.join(__dirname, ".."), {}).then((unused) => {
  if (unused.dependencies.length > 0) {
    console.warn(
      `depcheck failed because of unused deps: ${unused.dependencies.join(",")}`
    );
    process.exit(1);
  }
  if (unused.missing.length > 0) {
    console.warn(
      `depcheck failed because of missing deps: ${unused.missing.join(",")}`
    );
    process.exit(1);
  }
});
