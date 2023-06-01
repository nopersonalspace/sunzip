# Zip_tie_organizer_2891180.zip Error Breakdown

This zip file, as well as any others in this folder, are examples of 'real-world' zip files that failed in some way. This breakdown exists to document the problem, cause, and ultimately the solution to each failure.

## Problem

For some reason, it's in FILE_DATA mode but it's trying to read some extra fields from the local file header. This is either because the file header isn't parsing extra fields correctly, or the `rest` data being passed on is indexed wrong?

## The Cause

Inspecting the binary for this, it was apparent that the read file header was incorrect. The extra fields did not match. The cause was that the chunk was getting cut off such that only part of the data from the final binary header showed up. This caused the decompression to fail.

## The Fix

I added a new check that makes sure the expected length for the extra fields matches the data and fetches more chunks if not.
