import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import fs from "fs";
import path from "path";

import { template } from "./helpers/runFolder";

chai.use(chaiAsPromised);

describe("Real-world Zip File Tests", () => {
  const zipFiles = fs
    .readdirSync(path.join(__dirname, "zips/", "real/"))
    .filter((fileName) => fileName.includes(".zip"));

  template(zipFiles, path.join(__dirname, "zips/", "real"));
});
