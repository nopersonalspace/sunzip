import { PassThrough } from "stream";

/**
 * The Entry class represents one file or directory entry in the zip
 */
export class Entry extends PassThrough {
  fileMetadata: Record<string, any> = {};

  fileName: string;

  limit = 0;

  written = 0;

  size = 0;

  isDirectory = false;

  /**
   *
   * @param root0 - An object containing important metadata about the entry
   */
  constructor({
    fileMetadata,
    limit,
    size,
    written,
    isDirectory,
    ...rest
  }: {
    /** File metadata about the unzipped file */
    fileMetadata?: Record<string, any>;
    /** Size limit in bytes */
    limit?: number;
    /** Amount written out in bytes */
    written?: number;
    /** The file size (uncompressed) in bytes */
    size?: number;
    /** Is the file a directory? */
    isDirectory?: boolean;
  } = {}) {
    super(rest);
    this.fileMetadata = fileMetadata ?? this.fileMetadata;
    this.fileName = fileMetadata?.fileName;
    this.limit = limit ?? this.limit;
    this.size = size ?? this.size;
    this.written = written ?? this.written;
    this.isDirectory = isDirectory ?? this.isDirectory;
  }
}
