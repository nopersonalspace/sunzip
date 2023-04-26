/* eslint-disable max-lines */
import { Parser as BinaryParser } from "binary-parser";
import { PassThrough, pipeline, Transform, TransformCallback } from "stream";
import zlib from "zlib";

import { InvalidZipError } from "./errors";

export interface OutStream {
  stream: PassThrough;
  fileMetadata: Record<string, any>;
  limit: number;
  written: number;
  size: number;
  isDirectory: boolean;
}

enum Mode {
  LocalFileHeader = "LOCAL_FILE_HEADER",
  FileData = "FILE_DATA",
  CentralDirectory = "CENTRAL_DIRECTORY",
  // Used while searching for a signature to switch into another mode
  ReadingNextFlag = "READING_NEXT_FLAG",
  // If a flag can't be parsed from the data, then we enter this mode
  Unknown = "UNKNOWN",
}

/**
 * This interface allows us to have typed 'entry' emissions.
 */
export declare interface UnzipStream extends Transform {
  on(event: "entry", listener: (entry: OutStream) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: string, listener: Function): this;
}

export class UnzipStream extends Transform {
  // TODO: Not sure we need this as a seperate object from entry
  outStreamInfo: OutStream;

  entry: PassThrough;

  chunks: Buffer[] = [];

  mode: Mode;

  beforeFirstData = true;

  // TODO: We need the ability to pass in arguments
  constructor() {
    super({ objectMode: true, highWaterMark: 50 });

    this.outStreamInfo = {
      stream: new PassThrough(), // for now, we'll make the output stream a new pass through
      fileMetadata: {},
      limit: 0,
      written: 0,
      size: 0,
      isDirectory: false,
    };

    this.entry = new PassThrough();

    this.mode = Mode.ReadingNextFlag;
  }

  /**
   * Assembles the local file header using a buffer captured from the input stream
   *
   * @param bytes - The current buffer, starting at the local file header flax
   * @returns: A buffer with the rest of the bytes that aren't part of the header
   */
  assembleLocalFileHeader(
    bytes = Buffer.concat(this.chunks)
  ): Record<string, any> | undefined {
    // TODO: make a case here, if the first bytes are not the sig then we have a problem.
    // See https://libzip.org/specifications/appnote_iz.txt for more information about the zip spec
    const localFileHeaderParser = new BinaryParser()
      .endianness("little")
      .buffer("signature", { length: 4 })
      .uint16("versionsNeededToExtract")
      .uint16("bitFlag")
      .uint16("compressionMethod")
      .bit16("lastModifiedTime")
      .uint16("lastModifiedDate")
      .buffer("CRC32", { length: 4 })
      .uint32("compressedSize")
      .uint32("uncompressedSize")
      .uint16("fileNameLength")
      .uint16("extraFieldLength")
      .string("fileName", { length: "fileNameLength" })
      .array("extraField", {
        type: new BinaryParser()
          .endianness("little")
          .buffer("headerId", { length: 2 })
          .uint16("dataSize")
          .buffer("data", { length: "dataSize" }),
        lengthInBytes: "extraFieldLength",
      })
      .buffer("rest", { readUntil: "eof" });

    try {
      const localFileHeader = localFileHeaderParser.parse(bytes);
      if (localFileHeader.signature.equals(Buffer.from("504B0304", "hex"))) {
        return localFileHeader;
      }
      return undefined;
    } catch (e) {
      // If the parser fails because it runs out of bytes, then we need to
      // consume more bytes until it has enough. If it's a different error
      // then we throw it.
      if (!(e instanceof RangeError)) {
        throw e;
      }
      return undefined;
    }
  }

  /**
   * Looks at the byte flag to decide which mode to put the FSM into
   * @param bytes - The bytes containing the flag
   */
  _stateFromFlag(bytes = Buffer.concat(this.chunks)): Mode {
    const flagParser = new BinaryParser()
      .endianness("little")
      .buffer("flag", { length: 4 });

    try {
      const { flag } = flagParser.parse(bytes);

      if (flag.equals(Buffer.from("504B0304", "hex"))) {
        return Mode.LocalFileHeader;
      }

      if (flag.equals(Buffer.from("504B0102", "hex"))) {
        return Mode.CentralDirectory;
      }
      return Mode.Unknown;
    } catch (e) {
      // Keep going until we have enough bytes to parse a flag. Should only ever
      // take two chunks
      if (!(e instanceof RangeError)) {
        throw e;
      }

      return Mode.ReadingNextFlag;
    }
  }

  _createEntryStream(): void {
    if (this.outStreamInfo.isDirectory) {
      // Special case for a directory because there is no file data
      // We want to emit an empty stream with just the metadata
      this.emit("entry", {
        ...this.outStreamInfo,
        stream: null,
      });

      return;
    }
    if (this.outStreamInfo.fileMetadata.compressionMethod > 0) {
      this.entry = new PassThrough();
      const inflater = zlib.createInflateRaw();
      // inflater
      //   .on("end", () => {
      //     console.log(
      //       "STREAM ENDED - inflater",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("finish", () => {
      //     console.log(
      //       "STREAM FINISHED - inflater",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("close", () => {
      //     console.log(
      //       "STREAM CLOSED - inflater",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("error", (e) => {
      //     console.log(
      //       "STREAM ERROR - inflater",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   });
      // this.outStreamInfo.stream
      //   .on("end", () => {
      //     console.log(
      //       "STREAM ENDED - outStreamInfo.stream",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("finish", () => {
      //     console.log(
      //       "STREAM FINISHED - outStreamInfo.stream",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("close", () => {
      //     console.log(
      //       "STREAM CLOSED - outStreamInfo.stream",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("error", () => {
      //     console.log(
      //       "STREAM ERROR - outStreamInfo.stream",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   });

      // this.entry
      //   .on("end", () => {
      //     console.log(
      //       "STREAM ENDED - entry",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("finish", () => {
      //     console.log(
      //       "STREAM FINISHED - entry",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("close", () => {
      //     console.log(
      //       "STREAM CLOSED - entry",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   })
      //   .on("error", () => {
      //     console.log(
      //       "STREAM ERROR - entry",
      //       this.outStreamInfo.fileMetadata.fileName
      //     );
      //   });

      pipeline(this.outStreamInfo.stream, inflater, this.entry, (e) => {
        if (e) {
          this.emit("error", e);
        }
      });
    } else {
      pipeline(this.outStreamInfo.stream, this.entry, (e) => {
        if (e) {
          this.emit("error", e);
        }
      });
    }

    this.emit("entry", {
      ...this.outStreamInfo,
      stream: this.entry,
    });
  }

  _processNextChunk(
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    // Perform relevant actions, depending on the state
    switch (this.mode) {
      case Mode.ReadingNextFlag: {
        const mode = this._stateFromFlag(Buffer.concat(this.chunks));
        this.mode = mode;

        this._processNextChunk(encoding, callback);

        break;
      }

      case Mode.LocalFileHeader: {
        // Reset output stream
        this.outStreamInfo = {
          stream: new PassThrough(), // for now, we'll make the output stream a new pass through
          fileMetadata: {},
          limit: 0,
          written: 0,
          size: 0,
          isDirectory: false,
        };

        const localFileHeader = this.assembleLocalFileHeader(
          Buffer.concat(this.chunks)
        );

        if (localFileHeader && localFileHeader.uncompressedSize > 0) {
          this.mode = Mode.FileData;
          this.chunks = [localFileHeader.rest];

          // Set the length of the output file
          this.outStreamInfo.size = localFileHeader.compressedSize;
          this.outStreamInfo.fileMetadata = localFileHeader;

          this._createEntryStream();

          // we want to get the next chunk
          callback();
        } else if (localFileHeader) {
          this.mode = Mode.ReadingNextFlag;
          this.outStreamInfo.isDirectory = true;
          this.outStreamInfo.fileMetadata = localFileHeader;
          this.chunks = [localFileHeader.rest];

          this._createEntryStream();

          // get the next chunk
          callback();
        } else {
          // We need more chunks of data in the moving window before
          // we can find the complete localFileHeader
          callback();
        }

        break;
      }
      case Mode.FileData: {
        const allBuffer = Buffer.concat(this.chunks);

        // Slice the file out of the buffer
        const sliced = allBuffer.slice(
          0,
          this.outStreamInfo.size - this.outStreamInfo.written
        );

        // The rest of the buffer, after the file data. Probably a header of some kind.
        const rest = allBuffer.slice(
          this.outStreamInfo.size - this.outStreamInfo.written,
          allBuffer.length
        );

        // Write file data to output stream
        this.outStreamInfo.stream.write(sliced, encoding, callback);
        this.outStreamInfo.written += sliced.length;

        // Reset the chunks, since we've passed the data along
        this.chunks = [];
        // TODO: What happens if it's exactly 0?
        if (rest.length > 0) {
          // End file output stream
          // this.entry.end(undefined, encoding);
          this.outStreamInfo.stream.end(undefined, encoding);

          // Queue up next state
          this.mode = Mode.ReadingNextFlag;
          this.chunks = [rest];
        }
        break;
      }
      case Mode.CentralDirectory: {
        // For now, we ignore the current chunk and move on
        this.chunks = [];
        callback();
        break;
      }
      default:
        // For now, we ignore the current chunk and move on
        this.chunks = [];
        callback();
        break;
    }
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    try {
      // Special case, if no data has been read yet then we know the
      // first bytes should be the local file header signature
      if (this.beforeFirstData) {
        if (this._stateFromFlag(chunk) !== Mode.LocalFileHeader) {
          throw new InvalidZipError("Not a valid zip file");
        }
        this.beforeFirstData = false;
      }

      // Start by pushing the new chunks to the buffer
      this.chunks.push(chunk);

      this._processNextChunk(encoding, callback);
    } catch (e) {
      callback(e as Error);
    }
  }

  _flush(callback: any): any {
    // TODO: Getting a 'BAD FILE DESCRIPTOR' error when the central directory is hit
    if (Buffer.concat(this.chunks).length > 0) {
      this._processNextChunk("buffer" as BufferEncoding, () => {
        if (Buffer.concat(this.chunks).length > 0) {
          return setImmediate(() => {
            this._flush(callback);
          });
        }
        callback();
        return undefined;
      });

      return;
    }

    if (this.mode === Mode.FileData) {
      // uh oh, something went wrong
      callback(
        new Error("Stream finished in an invalid state, uncompression failed")
      );
      return;
    }
    if (this.mode === Mode.LocalFileHeader) {
      // This will happen when a file is too small to overflow the max buffer size,
      // but a local header wasn't found anywhere.
      callback(new InvalidZipError("Unable to find local header"));
      return;
    }

    setImmediate(callback);
  }
}
/* eslint-enable max-lines */
