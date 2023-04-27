import "mocha";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

import { UnzipStream } from "../unzip";

chai.use(chaiAsPromised);
const { expect } = chai;

const zipFiles = fs
  .readdirSync(path.join(__dirname, "zips/", "failure/"))
  .filter((fileName) => fileName.includes(".zip"));

describe("Failing Zip File Tests", () => {
  zipFiles.forEach((zipFileName) => {
    it(`should gracefully fail for ${zipFileName}`, (done) => {
      const myStream = fs.createReadStream(
        path.join(__dirname, "zips/", "failure/", zipFileName),
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
      ).to.be.rejected;
    });
  });
});

describe("Non-zip file tests", () => {
  function bufferToStream(buffer: Buffer): Readable {
    const stream = new Readable();
    const chunkSize = 1024; // Set chunk size as per your requirement
    let offset = 0;

    stream._read = () => {
      const chunk = buffer.slice(offset, offset + chunkSize);
      offset += chunk.length;
      stream.push(chunk.length > 0 ? chunk : null);
    };

    return stream;
  }
  it("should fail gracefully for non-zip file", () => {
    // Default high water mark is 65536
    const myStream = bufferToStream(randomBytes(65536));

    return expect(
      new Promise((resolve, reject) => {
        myStream
          .pipe(new UnzipStream())
          .on("error", (e) => {
            reject(e);
          })
          .on("finish", () => resolve(true));
      })
    ).to.be.rejected;
  });
});
