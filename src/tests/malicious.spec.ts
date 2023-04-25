import "mocha";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import fs from "fs";
import path from "path";

import { UnzipStream } from "../unzip";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("Malicious zip tests", () => {
  it("should correctly handle a zip bomb", (done) => {
    const myStream = fs.createReadStream(
      path.join(__dirname, "zips/", "shouldFail/", "bomb.zip"),
      { highWaterMark: 50 }
    );

    const myUnzipStream = new UnzipStream();

    expect(
      new Promise((resolve, reject) => {
        myStream
          .pipe(myUnzipStream)
          .on("entry", () => {
            done();
          })
          .on("finish", () => {
            resolve(undefined);
          })
          .on("error", (e) => {
            reject(e);
          });
      })
    ).to.be.rejectedWith("invalid stored block lengths");
  });
});
