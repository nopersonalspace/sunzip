import "mocha";

import fs from "fs";
import path from "path";

import { template } from "./helpers/runFolder";

describe("Working Zip File Tests", () => {
  const zipFiles = fs
    .readdirSync(path.join(__dirname, "zips/", "success/"))
    .filter((fileName) => fileName.includes(".zip"));

  template(zipFiles, path.join(__dirname, "zips/", "success"));
});
