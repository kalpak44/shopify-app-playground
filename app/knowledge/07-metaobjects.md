## Metaobjects (read_metaobjects / write_metaobjects)

- List definitions: `query ListMetaobjectDefs { metaobjectDefinitions(first: 20) { edges { node { id type name fieldDefinitions { key name type { name } } } } } }`
- List instances: `query ListMetaobjects { metaobjects(type: "color", first: 20) { edges { node { id handle fields { key value } } } } }`
- Upsert (create or update by handle): `mutation UpsertMetaobject { metaobjectUpsert(handle: { type: "color", handle: "red-swatch" }, metaobject: { fields: [{ key: "hex", value: "#FF0000" }] }) { metaobject { id handle } userErrors { field message } } }`

## Markets (read_markets / write_markets)

- `query ListMarkets { markets(first: 20) { edges { node { id name enabled primary regions(first: 5) { edges { node { ... on Country { name code } } } } } } } }`