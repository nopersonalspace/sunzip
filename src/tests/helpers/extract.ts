import { IFs } from "memfs";
import path from "path";
import { PassThrough, Readable } from "stream";
import { promisify } from "util";
import yauzl from "yauzl";

export const extractStream = (
  stream: Readable,
  filePath: string,
  outputPath: string,
  fs: IFs,
  isDirectory = false
): Promise<undefined> =>
  new Promise((resolve, reject) => {
    const completePath = path.join(outputPath, filePath);

    if (isDirectory && !fs.existsSync(completePath)) {
      console.log("making directory");
      promisify(fs.mkdir)(completePath)
        .then(() => resolve(undefined))
        .catch(reject);
      return;
    }

    console.log("writing to complete path", completePath);
    const outStream = fs.createWriteStream(completePath);
    stream.pipe(outStream).on("close", resolve).on("error", reject);
  });

export const extractFileAsync = (
  zipPath: string,
  extractPath: string,
  fs: IFs
): Promise<void> =>
  new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipFile) => {
      if (err) {
        reject(err);
      }

      zipFile.readEntry();
      zipFile.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) {
          console.log("yauzl is directory");
          extractStream(
            new PassThrough(),
            entry.fileName,
            extractPath,
            fs,
            true
          ).then(() => {
            zipFile.readEntry();
          });
        } else {
          console.log("yauzl is file");
          // file entry
          zipFile.openReadStream(entry, (err, readStream) => {
            if (err) throw err;
            readStream.on("end", () => {
              zipFile.readEntry();
            });

            extractStream(
              readStream,
              entry.fileName,
              extractPath,
              fs,
              /\/$/.test(entry.fileName)
            ).then(() => {
              zipFile.readEntry();
            });
            // readStream.pipe(somewhere);
          });
        }
      });

      zipFile.on("close", () => {
        resolve(undefined);
      });
    });
  });
