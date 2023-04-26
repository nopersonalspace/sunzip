import { IFs } from "memfs";
import path from "path";

export const compareDirectories = (
  dir1: string,
  dir2: string,
  fs: IFs
): boolean => {
  const files1 = fs.readdirSync(dir1);
  const files2 = fs.readdirSync(dir2);

  console.log(files1, files2);
  if (files1.length !== files2.length) {
    return false;
  }

  files1.sort();
  files2.sort();

  // Compare the files one by one
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < files1.length; i++) {
    const file1 = path.join(dir1, files1[i] as string);
    const file2 = path.join(dir2, files2[i] as string);

    const stats1 = fs.statSync(file1);
    const stats2 = fs.statSync(file2);

    // If the names and sizes of the files are not the same, return false
    if (files1[i] !== files2[i] || stats1.size !== stats2.size) {
      console.log("sizes not the same", stats1.size, stats2.size);
      return false;
    }

    // If the files are directories, compare their contents recursively
    if (stats1.isDirectory() && stats2.isDirectory()) {
      if (!compareDirectories(file1, file2, fs)) {
        console.log("recursive false");
        return false;
      }
    }
    // Otherwise, compare their contents byte by byte
    else {
      const data1 = fs.readFileSync(file1) as Buffer;
      const data2 = fs.readFileSync(file2) as Buffer;

      if (Buffer.compare(data1, data2) !== 0) {
        console.log("buffers different");
        return false;
      }
    }
  }

  // If all files are the same, return true
  return true;
};
