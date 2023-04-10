# Unzip Streaming Library

## Overview

Although unzipping a streamed zip file is considered out of spec, it can be done reliably and is a common use case. Often zip files are so large that storing them in memory is not an option, and in many deployments storing them (even temporarily) in the file system is not possible. For this scenario, unzipping the stream is the only option.

The goal of this library is to create a performant, easy to use, and fault tolerant unzip-streaming library that never stores the whole file in memory or on disk.

## Challenges

- The central directory of a zip file, essentially its table of contents, is at the end of the file. Unzipping a zip file in a stream precludes us from being able to use it. Instead, we have to rely on the local file headers that precede each file in the zip.
- Performance needs to be good, as we don't want this unzipping to be a bottleneck in a potentially long chain of streaming processes.
- Fault tolerance is important. Because unzip-streaming is technically out of spec for zip files, we need to handle any potential errors gracefully. Making error handling easy for developers is key to keeping this library from being a source of issues in an app.

## References

- [ZIP (file format) Wikipedia](https://github.com/transcend-io/main/pull/21920)
- [libzip ZIP format specification document](https://libzip.org/specifications/appnote_iz.txt)
- [libzip extra fields documentation](https://libzip.org/specifications/extrafld.txt)

## Functions

### `unzip()`

The base unzipping function. Used like `myStream.pipe(unzip())`. Generates a transform stream where each entry in the zip file can be processed.

### `unzip({ pattern: 'README.md' })`

Similarly to the base function, used like `myStream.pipeunzip({ pattern: 'README.md' }))`. However, this version only cares about a single file, with the path specified by `pattern`. It outputs a single stream with that file, ignoring all others in the archive. If multiple files are present with the exact same path (unlikely), it will return the first instance.
