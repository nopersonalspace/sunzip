import fs from "fs";

import { OutStream } from "../../unzip";

export const extractStream = (entry: OutStream, path: string): void => {
  const filename = `${path}/${entry.fileMetadata.fileName}`;
  const outStream = fs.createWriteStream(filename);
  if (entry.isDirectory && !fs.existsSync(filename)) {
    fs.mkdirSync(filename);
  }
  entry.stream.pipe(outStream);
};
