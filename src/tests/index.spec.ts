import "mocha";

import AdmZip from "adm-zip";
import { Buffer } from "buffer";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { Readable, Stream } from "stream";

// import npmPackage from "../index";
import { UnzipStream } from "../unzip";

const streamToBuffer = (stream: Stream): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on("data", (chunk) => chunks.push(chunk));

    stream.on("error", (error) => reject(error));

    stream.on("finish", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
  });

chai.use(chaiAsPromised);
const { expect } = chai;

const zipFiles = fs
  .readdirSync(path.join(__dirname, "zips/"))
  .filter((fileName) => fileName.includes(".zip"));
// const zipFiles = ["compressed.zip", "hello.zip", "padding.zip"];

zipFiles.forEach((zipFileName) => {
  describe(`Zip file test ${zipFileName}`, () => {
    let correctZipEntries: Record<string, Buffer> = {};

    beforeEach(() => {
      const zip = new AdmZip(path.join(__dirname, "zips/", zipFileName));
      zip.getEntries().forEach((entry) => {
        const fileContents = zip.readFile(entry);
        if (fileContents) {
          correctZipEntries[entry.entryName] = fileContents;
        }
      });
    });

    afterEach(() => {
      // Reset the buffers
      correctZipEntries = {};
    });

    it(`should correctly unzip ${zipFileName}`, () => {
      const myStream = fs.createReadStream(
        path.join(__dirname, "zips/", zipFileName),
        { highWaterMark: 50 }
      );
      return new Promise((resolve, reject) => {
        myStream
          .pipe(new UnzipStream())
          .on("entry", async (entry) => {
            if (!entry.isDirectory) {
              const buffer = await streamToBuffer(entry.stream);
              expect(
                correctZipEntries[entry.fileMetadata.fileName].equals(buffer)
              ).to.be.equal;
            } else {
              // Is a directory, just make sure it's present in the keys
              expect(
                Object.keys(correctZipEntries).includes(
                  entry.fileMetadata.fileName
                )
              );
            }
          })
          .on("finish", () => {
            resolve(undefined);
          })
          .on("error", (e) => {
            reject(e);
          });
      });
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
