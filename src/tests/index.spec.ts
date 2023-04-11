import "mocha";

import { Buffer } from "buffer";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { randomBytes } from "crypto";
import fs from "fs";
import { Readable } from "stream";
import { promisify } from "util";

import npmPackage from "../index";
import { UnzipStream } from "../unzip";
import { extractStream } from "./helpers/extract";

chai.use(chaiAsPromised);
const { expect } = chai;

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
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    return stream;
  }
  it.only("should consume a stream", async () => {
    const myStream = fs.createReadStream(`${__dirname}/hello.txt`, {
      highWaterMark: 50,
    });

    myStream
      .pipe(new UnzipStream())
      .on("entry", (entry) => {
        console.log("entry emitted");
        extractStream(entry, `${__dirname}/testout`);
      })
      .on("end", () => {
        console.log("STREAM ENDED - main stream");
      })
      .on("finish", () => {
        console.log("STREAM FINISHED - main stream");
      })
      .on("close", () => {
        console.log("STREAM CLOSED - main stream");
      })
      .on("error", () => {
        console.log("STREAM ERROR - main stream");
      });
  });

  it("should fail gracefully for non-zip file", () => {
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
