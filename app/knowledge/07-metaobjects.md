## Metaobjects (read_metaobjects / write_metaobjects)

### Queries

**`metaobjectByHandle(handle: { type, handle })`** — Fetch a single instance by handle.
- Returns: `id`, `handle`, `type`, `updatedAt`, `fields { key value }` (use `jsonValue` for JSON fields, `reference` / `references` for resource links)
- Capabilities: `{ publishable { status onlineStoreUrl } }`
- Field aliases work: `title: field(key: "title") { value }`

**`metaobjectDefinitionByType(type: String!)`** — Fetch a definition by its type string.
- Returns: `id`, `type`, `name`, `displayNameKey`, `hasThumbnailField`
- `fieldDefinitions { key name required type { name } validations { name value } }`
- `access { admin storefront }` — admin: `MERCHANT_READ` | `MERCHANT_READ_WRITE`; storefront: `NONE` | `PUBLIC_READ`
- `capabilities { publishable { enabled } translatable { enabled } }`

**`metaobjectDefinitions(first, after)`** — Paginated list of all definitions.

**`metaobjects(type: String!, first, after, query, sortKey)`** — List instances of a type.
- Field filtering: `query: "fields.{key}:{value}"` — e.g. `"fields.color:red"`
- `sortKey`: `ID` | `TYPE` | `UPDATED_AT` | `DISPLAY_NAME`
- Returns same shape as `metaobjectByHandle`

**`metaobject(id: ID!)`** — Fetch single instance by GID.

### Mutations

**`metaobjectDefinitionCreate(definition: MetaobjectDefinitionCreateInput!)`** — Create a new definition.
- Input: `{ name, type, access, capabilities, fieldDefinitions: [{ name, key, type, required, validations }] }`
- Use `$app:` prefix on `type` for app-reserved types (e.g. `"$app:product_highlight"`)
- `access`: `{ admin: MERCHANT_READ_WRITE, storefront: PUBLIC_READ }`
- `capabilities`: `{ publishable: { enabled: true }, translatable: { enabled: true } }`
- Returns: `metaobjectDefinition { id type fieldDefinitions { key } }`, `userErrors { field message code }`

**`metaobjectDefinitionUpdate(id: ID!, definition: MetaobjectDefinitionUpdateInput!)`** — Update a definition.

**`metaobjectDefinitionDelete(id: ID!)`** — Delete a definition. ⚠️ Cascading: deletes ALL metaobjects and metafields of this type.

**`metaobjectCreate(metaobject: MetaobjectCreateInput!)`** — Create a new instance.
- Input: `{ type, handle, fields: [{ key, value }], capabilities }`

**`metaobjectUpdate(id: ID!, metaobject: MetaobjectUpdateInput!)`** — Update an instance by ID.
- Input: `{ fields: [{ key, value }], handle, capabilities }`
- `capabilities`: `{ publishable: { status: ACTIVE | DRAFT } }`

**`metaobjectUpsert(handle: { type, handle }, metaobject: MetaobjectUpsertInput!)`** — Create or update by handle (idempotent).
- Input: `{ fields: [{ key, value }], capabilities }`

**`metaobjectDelete(id: ID!)`** — Delete a single instance by GID.

**`standardMetaobjectDefinitionEnable(type: String!)`** — Enable a Shopify standard metaobject template (e.g. `"shopify--1--Product_Feature"`).
- Returns: `metaobjectDefinition { id type }`, `userErrors { message }`

### Common patterns
- Lookup by handle: `metaobjectByHandle(handle: { type: "color", handle: "red-swatch" }) { id fields { key value } }`
- List with field filter: `metaobjects(type: "color", first: 10, query: "fields.status:active") { edges { node { id handle } } }`
- Upsert instance: `metaobjectUpsert(handle: { type: "color", handle: "red-swatch" }, metaobject: { fields: [{ key: "hex", value: "#FF0000" }] }) { metaobject { id } userErrors { field message } }`
- Create app-reserved definition: use `type: "$app:my_type"` so other apps cannot modify it

## Markets (read_markets / write_markets)

- `query ListMarkets { markets(first: 20) { edges { node { id name enabled primary regions(first: 5) { edges { node { ... on Country { name code } } } } } } } }`