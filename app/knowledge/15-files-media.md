## Files & Media (read_files / write_files / read_themes / read_images)

### List files

```graphql
query {
  files(first: 20, query: "media_type:IMAGE") {
    nodes {
      ... on MediaImage {
        id
        alt
        createdAt
        image { url width height }
      }
      ... on Video {
        id
        alt
        duration
        originalSource { url width height format mimeType }
        sources { url width height format mimeType }
        preview { status image { url width height } }
      }
      ... on GenericFile {
        id
        alt
        url
        createdAt
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**File union types:** `MediaImage`, `Video`, `GenericFile` (also `Model3d` for 3D).  
**Common fields on all types:** `id`, `alt`, `createdAt`, `updatedAt`.

**`query` filters:**
- `media_type:IMAGE` / `VIDEO` / `MODEL3D` / `GENERIC_FILE`
- `filename:banner*` — wildcard filename search
- `product_id:123` — files attached to a product
- `used_in:product` / `used_in:none` — filter by usage context
- `status:READY` / `FAILED` / `PROCESSING`
- `original_upload_size:>=1000000` — filter by file size in bytes
- `ids:gid://shopify/MediaImage/123,gid://shopify/MediaImage/456`

**`sortKey`:** `CREATED_AT`, `UPDATED_AT`, `FILENAME`, `ID`

### Create files

Requires `write_files`, `write_themes`, or `write_images` scope. Accepts up to 250 files per call. Files are processed **asynchronously** — check `fileStatus` (`READY` / `PROCESSING` / `FAILED`) after creation.

```graphql
mutation fileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      id
      fileStatus
      alt
      createdAt
      ... on MediaImage { image { url width height } }
      ... on GenericFile { url }
      ... on Video { sources { url mimeType } }
    }
    userErrors { field message code }
  }
}
```

**`FileCreateInput` fields:**
- `originalSource` (required) — external URL or staged upload URL from `stagedUploadsCreate`
- `contentType` — `IMAGE`, `VIDEO`, `EXTERNAL_VIDEO`, `MODEL_3D`, `FILE` (generic)
- `alt` — alt text; max 512 characters
- `filename` — custom filename; if omitted, derived from URL

**Duplicate filename handling:** configurable via `duplicateResolutionMode` — `APPEND_UUID` (default), `REPLACE`, or `RAISE_ERROR`.

### Update files

Requires `write_files` or `write_themes`. Files must be in `READY` state before updating. Supports batch updates.

```graphql
mutation fileUpdate($files: [FileUpdateInput!]!) {
  fileUpdate(files: $files) {
    files {
      id
      alt
      fileStatus
      ... on MediaImage { image { url width height } }
      ... on Video { sources { url width height } }
      ... on GenericFile { url }
    }
    userErrors { field message code }
  }
}
```

**`FileUpdateInput` fields:**
- `id` (required) — file GID
- `alt` — update alt text; max 512 characters
- `originalSource` — replace file content with a new URL (images and generic files only); preserves same file ID
- `previewImageSource` — replace video/3D thumbnail image; ⚠️ cannot set both `originalSource` and `previewImageSource` in the same entry
- `filename` — rename the file; extension must match the original

**By file type:**
- `MediaImage` / `GenericFile` — support `originalSource`, `filename`, `alt`
- `Video` / `Model3d` — support `previewImageSource`, `alt`; product reference add/remove

### Delete files

Requires `write_files`. Deletion is **permanent and irreversible** — files are immediately removed from wherever they appear (storefronts, product pages, themes, blogs). Files in-progress (currently being processed) are rejected.

```graphql
mutation fileDelete($fileIds: [ID!]!) {
  fileDelete(fileIds: $fileIds) {
    deletedFileIds
    userErrors { field message code }
  }
}
```

- Accepts an array of file GIDs (any union type: `MediaImage`, `Video`, `GenericFile`, etc.)
- Returns `deletedFileIds` — the IDs of successfully deleted files
- When deleting product-associated files, Shopify automatically removes media references and reorders remaining media
- Non-existent IDs return `FILE_DOES_NOT_EXIST` userError; `deletedFileIds` is `null` if any error occurs

### Fetch a single file by ID

Use `node(id)` with inline fragments since files are a union type:

```graphql
query {
  node(id: "gid://shopify/MediaImage/123") {
    ... on MediaImage {
      id
      alt
      image { url width height }
    }
    ... on Video {
      id
      duration
      sources { url mimeType }
    }
    ... on GenericFile {
      id
      url
    }
  }
}
```