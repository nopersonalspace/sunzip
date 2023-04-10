import "mocha";
import chai, { assert } from "chai";
import { Readable } from "stream";

import npmPackage from "../src/index";
import { Buffer } from "buffer";
import { UnzipStream, InvalidZipError } from "../src/unzip";
import { randomBytes } from "crypto";
import fs from "fs";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("NPM Package", () => {
  it("should be an object", () => {
    assert.isObject(npmPackage);
  });

  it("should have a UnzipStream property", () => {
    assert.property(npmPackage, "UnzipStream");
  });
});

describe("File streaming tests", () => {
  function bufferToStream(buffer: Buffer): Readable {
    var stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    return stream;
  }
  it("should consume a stream", () => {
    const myStream = fs.createReadStream(__dirname + "/test.zip", {
      highWaterMark: 100,
    });

    myStream.pipe(new UnzipStream()).on("entry", (entry) => {
      console.log("entry", entry.fileMetadata.fileName);
      entry.stream.pipe(process.stdout);
    });
  });

  it("should fail gracefully for non-zip file", async () => {
    const myStream = bufferToStream(randomBytes(2048));

    return expect(
      new Promise((resolve, reject) => {
        myStream
          .pipe(new UnzipStream())
          .on("error", (e) => {
            reject(e);
          })
          .on("end", () => resolve(true));
      })
    ).to.be.rejected;
  });
});
