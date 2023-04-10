import { PassThrough, Transform, TransformCallback, Writable } from "stream";
import { Parser as BinaryParser } from "binary-parser";

// Length of the local file header should not exceed this value
const LOCAL_FILE_HEADER_MAX_BYTES = 500;

interface OutStream {
  stream: Writable;
  fileMetadata: Record<string, any>;
  limit: number;
  written: number;
  size: number;
  isDirectory: boolean;
}

enum Mode {
  LocalFileHeader = "LOCAL_FILE_HEADER",
  FileData = "FILE_DATA",
  // Used while searching for a signature to switch into another mode
  ReadingNextFlag = "READING_NEXT_FLAG",
  // If a flag can't be parsed from the data, then we enter this mode
  Unknown = "UNKNOWN",
}

export class InvalidZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidZipError";
  }
}

export class UnzipStream extends Transform {
  outStreamInfo: OutStream;
  chunks: Buffer[] = [];
  mode: Mode;

  // TODO: We need the ability to pass in arguments
  constructor() {
    super({ objectMode: true });

    this.outStreamInfo = {
      stream: new PassThrough(), // for now, we'll make the output stream a new pass through
      fileMetadata: {},
      limit: 0,
      written: 0,
      size: 0,
      isDirectory: false,
    };

    this.mode = Mode.LocalFileHeader;
  }

  /**
   * Assembles the local file header using a buffer captured from the input stream
   *
   * @param bytes - The current buffer, starting at the local file header flax
   * @returns: A buffer with the rest of the bytes that aren't part of the header
   */
  assembleLocalFileHeader(bytes: Buffer): Record<string, any> | undefined {
    // Don't keep searching forever. If we still can't find/parse this after a while
    // then give up. The file is probably improperly formatted
    if (bytes.length > LOCAL_FILE_HEADER_MAX_BYTES) {
      throw new InvalidZipError("Could not find local file header");
    }

    // See https://libzip.org/specifications/appnote_iz.txt for more information about the zip spec
    var localFileHeaderParser = new BinaryParser()
      .endianness("little")
      .bit32("signature")
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
      return localFileHeaderParser.parse(bytes);
    } catch (e) {
      // If the parser fails because it runs out of bytes, then we need to
      // consume more bytes until it has enough. If it's a different error
      // then we throw it.
      if (!(e instanceof RangeError)) {
        throw e;
      }
    }
  }

  /**
   * Looks at the byte flag to decide which mode to put the FSM into
   * @param bytes - The bytes containing the flag
   */
  _stateFromFlag(bytes: Buffer): Mode {
    const flagParser = new BinaryParser()
      .endianness("little")
      .buffer("flag", { length: 4 });

    try {
      const { flag } = flagParser.parse(bytes);

      if (flag.equals(Buffer.from("504B0304", "hex"))) {
        return Mode.LocalFileHeader;
      } else {
        return Mode.Unknown;
      }
    } catch (e) {
      // Keep going until we have enough bytes to parse a flag. Should only ever
      // take two chunks
      if (!(e instanceof RangeError)) {
        throw e;
      }

      return Mode.ReadingNextFlag;
    }
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    try {
      // Start by pushing the new chunks to the buffer
      this.chunks.push(chunk);

      // Perform relevant actions, depending on the state
      switch (this.mode) {
        case Mode.ReadingNextFlag:
          this.mode = this._stateFromFlag(Buffer.concat(this.chunks));

        case Mode.LocalFileHeader:
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

            this.emit("entry", this.outStreamInfo);
          } else if (localFileHeader) {
            this.outStreamInfo.isDirectory = true;
            this.outStreamInfo.fileMetadata = localFileHeader;
            this.chunks = [localFileHeader.rest];

            this.emit("entry", this.outStreamInfo);
          }

          break;
        case Mode.FileData:
          // Mock streaming out the chunks by printing
          const allBuffer = Buffer.concat(this.chunks);

          // Slice the file out of the buffer
          const sliced = allBuffer.slice(
            0,
            this.outStreamInfo.size - this.outStreamInfo.written
          );

          // The rest of the buffer, after the file data
          const rest = allBuffer.slice(
            this.outStreamInfo.size - this.outStreamInfo.written,
            allBuffer.length
          );

          // Write file data to output stream
          this.outStreamInfo.stream.write(sliced);
          this.outStreamInfo.written += sliced.length;

          if (rest.length > 0) {
            //End output stream
            this.outStreamInfo.stream.end();

            // Queue up next state
            this.mode = Mode.ReadingNextFlag;
            this.chunks = [rest];
          }
          break;
        case Mode.Unknown:
          console.log("in the unknown case");
          break;
      }

      callback(undefined, chunk);
    } catch (e) {
      callback(e as Error);
    }
  }
}
