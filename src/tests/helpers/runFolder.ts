import "mocha";

import AdmZip from "adm-zip";
import { Buffer } from "buffer";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import fs from "fs";
import path from "path";
import { Stream } from "stream";

// import npmPackage from "../index";
import { UnzipStream } from "../../unzip";

export const streamToBuffer = (stream: Stream): Promise<Buffer> =>
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

export const template = (zipFiles: string[], folderPath: string): void =>
  zipFiles.forEach((zipFileName) => {
    describe(`Zip file test ${zipFileName}`, () => {
      let correctZipEntries: Record<string, Buffer> = {};

      beforeEach(() => {
        const zip = new AdmZip(path.join(folderPath, zipFileName));
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
        const highWaterMark = Number(process.env.MOCHA_HIGH_WATER_MARK ?? 50);

        const myStream = fs.createReadStream(
          path.join(folderPath, zipFileName),
          { highWaterMark }
        );

        let atLeastOneEmitted = false;
        return new Promise((resolve, reject) => {
          myStream
            .pipe(new UnzipStream())
            .on("entry", async (entry) => {
              atLeastOneEmitted = true;
              if (!entry.isDirectory) {
                const buffer = await streamToBuffer(entry);

                expect(
                  correctZipEntries[entry.fileMetadata.fileName]
                ).to.deep.equal(buffer);
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
              expect(atLeastOneEmitted, "No entries were emitted").to.be.true;
              resolve(undefined);
            })
            .on("error", (e) => {
              reject(e);
            });
        });
      });
    });
  });
