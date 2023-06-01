/* eslint-disable max-lines */
import { Parser as BinaryParser } from "binary-parser";
import { PassThrough, pipeline, Transform, TransformCallback } from "stream";
import zlib from "zlib";

import { Entry } from "./entry";
import { InvalidZipError } from "./errors";

export interface OutStream {
  /** The stream itself */
  stream: PassThrough;
  /** File metadata about the unzipped file */
  fileMetadata: Record<string, any>;
  /** Size limit in bytes */
  limit: number;
  /** Amount written out in bytes */
  written: number;
  /** The file size (uncompressed) in bytes */
  size: number;
  /** Is the file a directory? */
  isDirectory: boolean;
}

/**
 * Mode represents the different states the FSM might be in as it
 * progresses through the process of reading the zip file.
 */
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
  on(event: "entry", listener: (entry: Entry) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: string, listener: Function): this;
}

/**
 * UnzipStream is the main class, used to perform the unzipping
 */
export class UnzipStream extends Transform {
  // TODO: Not sure we need this as a seperate object from entry
  outStream = new PassThrough();

  entry: Entry;

  chunks: Buffer[] = [];

  mode: Mode;

  beforeFirstData = true;

  bytesProcessed = 0;

  // TODO: We need the ability to pass in arguments
  /**
   *
   */
  constructor() {
    super({ objectMode: true, highWaterMark: 50 });

    this.entry = new Entry({
      fileMetadata: {},
      limit: 0,
      written: 0,
      size: 0,
      isDirectory: false,
    });

    this.mode = Mode.ReadingNextFlag;
  }

  /**
   * Assembles the local file header using a buffer captured from the input stream
   * @param bytes - The current buffer, starting at the local file header flax
   * @returns A buffer with the rest of the bytes that aren't part of the header
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
      .buffer("fileNameBytes", { length: "fileNameLength" })
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

      if (
        // Signature is the correct local file header flag
        localFileHeader.signature.equals(Buffer.from("504B0304", "hex")) &&
        // Extra fields are not cutoff
        localFileHeader.extraField.every(
          (field: any) => field.dataSize === field.data.length
        ) &&
        // File name not cutoff
        localFileHeader.fileNameLength === localFileHeader.fileNameBytes.length
      ) {
        return {
          ...localFileHeader,
          fileName: localFileHeader.fileNameBytes.toString("utf8"),
        };
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
   * @returns A new mode for the FSM
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

  /**
   *
   */
  _createEntryStream(): void {
    if (this.entry.isDirectory) {
      // Special case for a directory because there is no file data
      // We want to emit an empty stream with just the metadata
      this.emit("entry", this.entry);

      return;
    }
    if (this.entry.fileMetadata.compressionMethod > 0) {
      const inflater = zlib.createInflateRaw();
      // inflater
      //   .on("end", () => {
      //     console.log(
      //       "STREAM ENDED - inflater",
      //       this.entry.fileMetadata.fileName
      //     );
      //   })
      //   .on("finish", () => {
      //     console.log(
      //       "STREAM FINISHED - inflater",
      //       this.entry.fileMetadata.fileName
      //     );
      //   })
      //   .on("close", () => {
      //     console.log(
      //       "STREAM CLOSED - inflater",
      //       this.entry.fileMetadata.fileName
      //     );
      //   })
      //   .on("error", (e) => {
      //     console.log(
      //       "STREAM ERROR - inflater",
      //       this.entry.fileMetadata.fileName
      //     );
      //   });
      // this.outStream
      //   .on("end", () => {
      //     console.log(
      //       "STREAM ENDED - outStreamInfo.stream",
      //       this.entry.fileMetadata.fileName
      //     );
      //   })
      //   .on("finish", () => {
      //     console.log(
      //       "STREAM FINISHED - outStreamInfo.stream",
      //       this.entry.fileMetadata.fileName
      //     );
      //   })
      //   .on("close", () => {
      //     console.log(
      //       "STREAM CLOSED - outStreamInfo.stream",
      //       this.entry.fileMetadata.fileName
      //     );
      //   })
      //   .on("error", () => {
      //     console.log(
      //       "STREAM ERROR - outStreamInfo.stream",
      //       this.entry.fileMetadata.fileName
      //     );
      //   });

      // this.entry
      //   .on("end", () => {
      //     console.log("STREAM ENDED - entry", this.entry.fileMetadata.fileName);
      //   })
      //   .on("finish", () => {
      //     console.log(
      //       "STREAM FINISHED - entry",
      //       this.entry.fileMetadata.fileName
      //     );
      //   })
      //   .on("close", () => {
      //     console.log(
      //       "STREAM CLOSED - entry",
      //       this.entry.fileMetadata.fileName
      //     );
      //   })
      //   .on("error", () => {
      //     console.log("STREAM ERROR - entry", this.entry.fileMetadata.fileName);
      //   });

      pipeline(this.outStream, inflater, this.entry, (e) => {
        if (e) {
          this.emit("error", e);
        }
      });
    } else {
      // this.entry = new Entry(this.outStreamInfo);
      pipeline(this.outStream, this.entry, (e) => {
        if (e) {
          this.emit("error", e);
        }
      });
    }

    this.emit("entry", this.entry);
  }

  /**
   * This function processes the next chunk according to the state of the FSM
   * @param encoding - The encoding of the buffer chunks
   * @param callback - The transform stream callback from _transform()
   */
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
        this.entry = new Entry({
          fileMetadata: {},
          limit: 0,
          written: 0,
          size: 0,
          isDirectory: false,
        });

        const localFileHeader = this.assembleLocalFileHeader(
          Buffer.concat(this.chunks)
        );

        if (localFileHeader && localFileHeader.uncompressedSize > 0) {
          this.mode = Mode.FileData;
          this.chunks = [localFileHeader.rest];

          // Set the length of the output file
          this.entry.size = localFileHeader.compressedSize;
          this.entry.fileMetadata = localFileHeader;

          this._createEntryStream();

          // we want to get the next chunk
          callback();
        } else if (localFileHeader) {
          this.mode = Mode.ReadingNextFlag;
          this.entry.isDirectory = true;
          this.entry.fileMetadata = localFileHeader;
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
        const sliced = allBuffer.slice(0, this.entry.size - this.entry.written);

        // The rest of the buffer, after the file data. Probably a header of some kind.
        const rest = allBuffer.slice(
          this.entry.size - this.entry.written,
          allBuffer.length
        );

        // Write file data to output stream
        this.outStream.write(sliced, encoding, callback);
        this.entry.written += sliced.length;

        // Reset the chunks, since we've passed the data along
        this.chunks = [];
        // TODO: What happens if it's exactly 0?
        if (rest.length > 0) {
          // End file output stream
          // TODO: Do we really want to end the stream manually like this? Seems to work either way
          // this.entry.end(undefined, encoding);

          // Kill and re-make the outStream. This prevents memory issues and
          // stops node from emitting MaxListenersExceededWarning
          this.outStream.end();
          this.outStream = new PassThrough();

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

  /**
   * The main _transform() function, from the parent class TransformStream
   * @param chunk - The next chunk of input data
   * @param encoding - The encoding of the chunk
   * @param callback - The callback. Used to pass along errors, and to get the next chunk
   */
  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    this.bytesProcessed += chunk.length;
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

  /**
   * _flush() is from the parent class TransformStream. It's called when it's time to flush the bytes stored
   * in memory downstream.
   * @param callback - The _transform() callback
   */
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
