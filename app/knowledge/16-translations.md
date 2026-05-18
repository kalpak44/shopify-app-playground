## Translations (read_translations / write_translations)

Writing translations is a two-step process:
1. Fetch current translatable content + digest values
2. Register translations using those digests

### Fetch translatable content by resource IDs

Requires `read_translations`. Returns the source content and `digest` for each translatable field — **the digest is required** when calling `translationsRegister`.

```graphql
query {
  translatableResourcesByIds(first: 10, resourceIds: ["gid://shopify/Product/123"]) {
    edges {
      node {
        resourceId
        translatableContent {
          key
          value
          digest
          locale
        }
      }
    }
  }
}
```

- `resourceIds` accepts any translatable GIDs: products, collections, product variants, pages, blogs, articles, metaobjects, etc.
- `translatableContent` fields: `key` (e.g. `title`, `body_html`, `handle`, `product_type`), `value` (current source text), `digest` (SHA256 of the source value), `locale` (source locale, e.g. `en`)
- The digest changes whenever the source value changes — always fetch fresh digests before registering translations

### Read translations on a resource

Already covered inline on each resource — e.g. `product { translations(locale: "fr") { key value } }`. Add `marketId` for market-specific translations.