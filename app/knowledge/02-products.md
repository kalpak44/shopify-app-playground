## Products & Collections (read_products / write_products)

### Products
- Count: `productsCount(query, limit)` — returns `{ count, precision }`. Same `query` filters as `products()`. Capped at 10000 by default; pass `limit: null` to remove the cap. `precision` is `EXACT` or `AT_LEAST`.
- List: `query ListProducts { products(first: 50) { edges { node { id title status variants(first: 5) { edges { node { id title price sku inventoryQuantity } } } } } } }`
- `products(first, query, sortKey, reverse, after)` — paginated list with full filter support
  - **`sortKey`:** `ID` (default), `TITLE`, `PRODUCT_TYPE`, `VENDOR`, `UPDATED_AT`, `CREATED_AT`, `PUBLISHED_AT`, `INVENTORY_TOTAL`, `RELEVANCE`; combine with `reverse: true` for descending
  - **`query` filters:**
    - `title:*headphone*` — wildcard title search
    - `status:ACTIVE` / `DRAFT` / `ARCHIVED`
    - `vendor:Nike`
    - `sku:ABC-123` — matches any variant SKU
    - `barcode:012345678901`
    - `tag:sale` / `tag_not:clearance` — include/exclude by tag
    - `product_type:Shoes`
    - `collection_id:gid://shopify/Collection/123`
    - `price:>10 price:<=50` — price range (variant price)
    - `inventory_total:>0`
    - `out_of_stock_somewhere:true`
    - `is_price_reduced:true` — has compareAtPrice > price
    - `has_only_default_variant:true`
    - `has_only_composites:true` / `has_variant_with_components:true` — bundle/composite products
    - `bundles:true` / `gift_card:true`
    - `tracks_inventory:true`
    - `handle:my-product-handle`
    - `variant_id:gid://shopify/ProductVariant/456`
    - `variant_title:Small`
    - `created_at:>2024-01-01` / `updated_at:<2025-01-01` / `published_at:>2024-06-01`
    - `published_status:published` / `unpublished` / `any` — or channel-scoped: `published_status:published_in:<publicationId>`
    - `metafields.{namespace}.{key}:value` — filter by metafield value
    - `delivery_profile_id:gid://shopify/DeliveryProfile/123`
    - `category_id:gid://shopify/TaxonomyCategory/...`
    - `combined_listing_role:PARENT` / `CHILD`
    - `error_feedback:true` — has resource feedback errors
    - `publication_ids:gid://shopify/Publication/123`
  - Use GraphQL aliases to fetch multiple filtered sets in one query: `newestProducts: products(first: 5, sortKey: CREATED_AT, reverse: true) { ... }`
- Create: `mutation CreateProduct { productCreate(input: { title, descriptionHtml, vendor, productType, tags, status }) { product { id } userErrors { field message } } }`
  - Products are created UNPUBLISHED by default. Call `publishablePublish` to make them live.
- Update: `productUpdate(product: ProductUpdateInput!, media: [CreateMediaInput!], identifier: ProductUpdateIdentifiers)` — updates scalar/meta fields; does **not** update variants (use `productVariantsBulkUpdate`). Key `ProductUpdateInput` fields: `id`, `title`, `descriptionHtml`, `handle`, `vendor`, `productType`, `status`, `tags`, `seo { title description }`, `metafields`. Pass `media` to add new media items (async); each `CreateMediaInput` needs `originalSource`, `mediaContentType` (`IMAGE`, `VIDEO`, `EXTERNAL_VIDEO`, `MODEL_3D`), optional `alt`. Throttle: at 50 000 store variants, limited to 1 000 variant updates/day.
- Upsert (sync from external source): `productSet(input: ProductSetInput!, identifier: ProductSetIdentifiers, synchronous: Boolean)` — creates or updates a product in one call. **List fields** (`variants`, `collections`, `metafields`, `productOptions`) use **replace semantics**: entries in the input are created/updated; existing entries NOT in the input are **deleted**. All other fields update only what's included.
  - `identifier` — optional; specifies how to look up an existing product: `{ id: "gid://..." }`, `{ handle: "my-handle" }`, or `{ customId: { namespace, key, value } }` (match on a metafield value). Without `identifier`, always creates.
  - `input.productOptions` — `[{ name, position, values: [{ name }] }]` — sets options and their values; omitted options are deleted
  - `input.variants` — `[{ optionValues: [{ optionName, name }], price, compareAtPrice, inventoryQuantities: [{ locationId, name: "available", quantity }], file: { originalSource, contentType, alt, filename } }]` — omitted variants are deleted
  - `input.files` — product-level media array, same shape as `FileCreateInput`
  - `synchronous: true` (default) returns `product { id }`; `synchronous: false` returns `productSetOperation { id status }` — poll via `productOperation`
  - ⚠️ To clear all custom options/variants (revert to default variant): pass `productOptions: []` and `variants: []`
  - Variant limit: 2048 per product
- Duplicate: `productDuplicate(productId: ID!, newTitle: String!, newStatus: ProductStatus, includeImages: Boolean, includeTranslations: Boolean, synchronous: Boolean)` — `synchronous: true` (default) returns `newProduct { id }`; `synchronous: false` returns `productDuplicateOperation { id status }` for async polling. Metafield unique-value fields are not duplicated.
- Count variants: `productVariantsCount(limit)` — returns `{ count, precision }`. No supported query filters. Capped at 10000; pass `limit: null` to remove the cap.
- List variants (shop-wide): `productVariants(first, query, sortKey, reverse, after)` — cross-product variant search
  - **`sortKey`:** `ID` (default), `INVENTORY_LEVELS_AVAILABLE`
  - **`query` filters** (variant-specific, differs from `products` query):
    - `product_id:123` / `product_ids:123,456` — scope to one or more products
    - `sku:element*` — wildcard SKU search
    - `barcode:ABC-123`
    - `collection:465903092033` — variants belonging to a collection
    - `inventory_quantity:>0`
    - `location_id:123` — stocked at a specific location
    - `option1:small` / `option2:medium` / `option3:large`
    - `product_status:ACTIVE,DRAFT`
    - `product_type:snowboard`
    - `tag:sale` / `tag_not:clearance`
    - `taxable:false`
    - `title:ice`
    - `vendor:Snowdevil`
    - `updated_at:>2021-01-01`
    - `requires_components:true`
    - `exclude_composite:true` / `exclude_variants_with_components:true`
    - `gift_card:true`
    - `managed:true` / `managed_by:shopify` — fulfillment service tracking
    - `delivery_profile_id:123`
    - `published_status` / `product_publication_status` — same channel visibility syntax as `products`
- Fetch variant by identifier: `productVariantByIdentifier(identifier: { customId: { namespace, key, value } })` — looks up a variant by metafield value; returns `null` if not found. Key fields: `id`, `title`, `displayName`, `price`, `compareAtPrice`, `sku`, `barcode`, `availableForSale`, `inventoryQuantity`, `inventoryPolicy`, `selectedOptions`, `position`, `taxable`, `sellableOnlineQuantity`, `product { id }`, `metafield(namespace, key)`, `translations(locale, marketId)`, `contextualPricing(context)`, `unitPrice`, `unitPriceMeasurement`, `media(first)`, `deliveryProfile`, `requiresComponents`, `productVariantComponents(first)`, `productParents(first)`
- Reorder product options and option values: `productOptionsReorder(productId: ID!, options: [OptionReorderInput!]!)` — the order of options in the input array sets their new positions (`option1`, `option2`, …). Each entry identifies the option by `id` or `name`; include `values: [{ name }]` to also reorder that option's values. Omit `values` for an option to keep its current value order. Variant order is recalculated from the new option/value positions. ⚠️ If `values` is provided, ALL existing values for that option must be included — any missing value returns `MISSING_OPTION_VALUE` userError.
- Reorder product media: `productReorderMedia(id: ID!, moves: [MoveInput!]!)` — async; returns `job { id }`. Each `MoveInput` is `{ id: "gid://shopify/MediaImage/...", newPosition: "N" }` (zero-based string). Only include media items that need repositioning — unchanged items maintain their relative order automatically. Poll with `job(id) { done }`. Check `mediaUserErrors` (not `userErrors`) for errors.
- Add variants to an existing product: `productVariantsBulkCreate(productId, variants: [{ price, compareAtPrice, optionValues: [{ name, optionId }] }])`
⚠️ **Removed/nonexistent variant fields — never use these:**
- `ProductVariant.inventoryManagement` — removed in API 2026-04. To check if tracking is enabled use `inventoryItem { tracked }` (boolean). To control oversell behavior use `inventoryPolicy` (`DENY` or `CONTINUE`).

- Update variant price/compareAtPrice: ⚠️ `productVariantUpdate` does NOT exist — always use `productVariantsBulkUpdate`:
  ```graphql
  mutation UpdateVariantPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price compareAtPrice }
      userErrors { field message }
    }
  }
  ```
  Variables: `{ "productId": "gid://shopify/Product/123", "variants": [{ "id": "gid://shopify/ProductVariant/456", "price": "29.99", "compareAtPrice": "39.99" }] }`
- Browse product taxonomy: `taxonomy { categories(first, search, childrenOf, siblingsOf, descendantsOf) { nodes { id name } } }` — no scope required. Each `TaxonomyCategory` has `id` (e.g. `sg-4-17-2-17`), name, and hierarchy info. Navigation:
  - No args → top-level categories
  - `search: "snowboard"` → global text search
  - `childrenOf: "gid://..."` / `siblingsOf: "..."` / `descendantsOf: "..."` → hierarchy traversal
  - Use returned IDs in `products(query: "category_id:sg-4-17-2-17")` or smart collection `PRODUCT_TAXONOMY_NODE_ID` rules
- List publications (sales channels): `publications(first, catalogType)` — requires `read_publications`. Returns `{ id, autoPublish, supportsFuturePublishing }`. Use to look up a `publicationId` before calling `publishablePublish`. `catalogType` filter: `MARKET`, `COMPANY_LOCATION`, `APP` (omit for all).
- Publish a product: `mutation PublishProduct { publishablePublish(id: "gid://shopify/Product/123", input: { publicationId: "gid://shopify/Publication/..." }) { ... } }`
- Create a product bundle (fixed bundle): `productBundleCreate(input: { title, components: [{ productId, optionValues: [{ name, linkedMetafieldValue }] }] })` — requires `write_products` and the bundles feature. Returns `productBundleOperation { id status }`. Async — poll with `productOperation(id) { ... on ProductBundleOperation { status product { id } userErrors { field message } } }`.
- Update a product bundle: `productBundleUpdate(input: { productId, ... })` — same async pattern, returns `productBundleOperation`.
- Async product operations: several mutations (`productSet`, `productDelete`, `productDuplicate`, `productBundleCreate`) are asynchronous and return an operation ID. Poll with `productOperation(id)` using inline fragments until `status: "COMPLETE"`:
  ```graphql
  query { productOperation(id: $id) {
    ... on ProductSetOperation { status product { id } userErrors { field message code } }
    ... on ProductDeleteOperation { status deletedProductId }
    ... on ProductDuplicateOperation { status newProduct { id title } userErrors { field message } }
    ... on ProductBundleOperation { status product { id } userErrors { field message } }
  } }
  ```
  Status values: `CREATED` → `ACTIVE` → `COMPLETE`.
- Fetch by handle/id/metafield: use `productByIdentifier(identifier: ...)` — three identifier forms:
  - `{ handle: "ipod-nano" }` — by URL handle (handle is auto-generated from title; renaming product does NOT update handle)
  - `{ id: "gid://shopify/Product/123" }` — by GID
  - `{ customId: { namespace: "custom", key: "id", value: "1001" } }` — by metafield value (useful for ERP/external IDs)
  - Returns `null` if not found
  - `productByHandle` is **deprecated** — always use `productByIdentifier` instead
- Fetch by ID: `product(id: "gid://shopify/Product/123")` — returns `null` if not found. Key fields:
  - `id`, `title`, `handle`, `status` (`ACTIVE`/`ARCHIVED`/`DRAFT`), `vendor`, `productType`, `tags`, `descriptionHtml`, `description`
  - `priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }`
  - `totalInventory`, `tracksInventory`, `hasOnlyDefaultVariant`, `hasOutOfStockVariants`
  - `onlineStoreUrl`, `onlineStorePreviewUrl`, `publishedAt`, `createdAt`, `updatedAt`
  - `seo { title description }`, `templateSuffix`
  - `variantsCount { count }`, `mediaCount { count }`
  - `inCollection(id: "gid://shopify/Collection/123")` — Boolean; complement to `collection.hasProduct`
  - `options { name }` — list of option names (e.g. Size, Color)
  - `featuredMedia { id }` — first media item
- Fetch product metafields: `product { metafield(namespace: "my_fields", key: "liner_material") { value } }` or `metafields(first: 10, namespace: "...", keys: ["ns.key"])` 
- Fetch product media with type filter: `product { media(first: 10, query: "media_type:IMAGE", sortKey: POSITION) { nodes { id alt ... on MediaImage { image { url width height } } ... on Video { sources { url format } originalSource { url format } } ... on ExternalVideo { host originUrl } ... on Model3d { sources { url format } } } } }`
  - `media_type` values: `IMAGE`, `VIDEO`, `MODEL_3D`, `EXTERNAL_VIDEO`; `sortKey`: `POSITION` (default), `ID`
- Product translations: `product { translations(locale: "fr") { key value } }` — returns translated fields (e.g. `title`, `body_html`). Add `marketId` to get market-specific localizations: `translations(locale: "fr", marketId: "gid://shopify/Market/123")`
- Check contextual publication: `product { publishedInContext(context: { country: CA }) }` — requires `read_publications`
- Collections a product belongs to: `product { collections(first: 10) { nodes { id title } } }`
- Product resource feedback (Sales Channel apps only): `productResourceFeedback(id: "gid://shopify/Product/123") { state messages feedbackGeneratedAt }` — requires `read_resource_feedbacks` scope and app must be a Sales Channel or Storefront API app. `state` is `REQUIRES_ACTION` or `SUCCESS`. Returns `null` if product not found.

### Collections / Categories
- "Categories" in Shopify are Collections. Two types: manual and smart (rule-based).
- List: `query ListCollections { collections(first: 50) { edges { node { id title productsCount { count } } } } }`
- Get by ID: `collection(id: "gid://shopify/Collection/123") { id title handle descriptionHtml sortOrder image { url } productsCount { count } updatedAt }`
- Create manual: `collectionCreate(input: { title, descriptionHtml, handle, products: ["gid://shopify/Product/..."], image: { src, altText }, metafields: [{ namespace, key, type, value }] })` — returns `{ collection { id } userErrors { field message } }`. `products` seeds the collection at creation time.
- Create smart (automated): include `ruleSet: { appliedDisjunctively: false, rules: [{ column: TAG, relation: EQUALS, condition: "sale" }] }` in the input. For metafield-based rules (`PRODUCT_METAFIELD_DEFINITION` / `VARIANT_METAFIELD_DEFINITION`), also pass `conditionObjectId: "gid://shopify/MetafieldDefinition/..."` on the rule.
- Add products to a manual collection: `mutation AddProducts { collectionAddProducts(id, productIds: [...]) { collection { id } userErrors { field message } } }` — ⚠️ if **any** product in the batch already belongs to the collection, the entire operation fails and no products are added. Non-existent product IDs are silently ignored. Fails on smart collections.
  - For large batches, use the async variant: `collectionAddProductsV2(id, productIds: [...]) { job { id } userErrors { field message } }` — returns a `Job`; poll with `query { job(id: $id) { done } }` to track completion. Products are added in the order specified.
- Duplicate: `collectionDuplicate(input: { collectionId, newTitle, copyPublications }) { collection { id } job { id } userErrors { field message } }` — `copyPublications: false` to skip copying sales channel publications. May return a `job` (poll with `query { job(id) { done } }`) if the collection has many products; synchronous otherwise. Metafield unique-value fields are not duplicated.
- Delete: `collectionDelete(input: { id }) { deletedCollectionId userErrors { field message } }` — products in the collection are NOT deleted, only the collection itself. Returns `deletedCollectionId: null` with a `userErrors` entry if the collection doesn't exist. Not available on Starter/Retail plans.
- Update: `collectionUpdate(input: { id, title, descriptionHtml, handle, ruleSet, sortOrder, image, metafields })` — `image: null` removes the collection image. `sortOrder` values: `MANUAL`, `BEST_SELLING`, `ALPHA_ASC`, `ALPHA_DESC`, `PRICE_DESC`, `PRICE_ASC`, `CREATED`, `CREATED_DESC`. Must set `sortOrder: MANUAL` before calling `collectionReorderProducts`. Updating `ruleSet` on a smart collection may be async and returns a `job { id done }` — returns `userErrors` if you try to set rules on a manual collection.
- Reorder products in a manual collection: `collectionReorderProducts(id, moves: [{ id: "gid://shopify/Product/...", newPosition: "0" }]) { job { id } userErrors { field message } }` — always async; poll with `job(id) { done }`. Only include products that changed position (not the full list); `newPosition` is zero-based and evaluated after each preceding move in the list. Max 250 moves. ⚠️ Fails with userError if collection is not `MANUAL` sort order.
- Collections are **unpublished by default** — call `publishablePublish` after creation to make them live.
- Check if a product is in a collection: `collection { hasProduct(id: "gid://shopify/Product/...") }`
- Smart collection rules shape: `ruleSet { appliedDisjunctively rules { column relation condition } }` — `appliedDisjunctively: true` means ANY rule matches (OR), `false` means ALL rules must match (AND).
- Count collections: `collectionsCount(query, limit)` — returns `{ count, precision }`. Useful filters: `collection_type:custom`, `collection_type:smart`, `product_id:gid://...` (collections containing a product), `published_status:published`.
- Use `collectionRulesConditions { ruleType allowedRelations defaultRelation }` to discover all valid rule columns and their allowed relations.
- Smart collection rule columns: `TITLE`, `VARIANT_TITLE`, `TYPE`, `VENDOR`, `TAG` (text — EQUALS/CONTAINS/etc.), `VARIANT_PRICE`, `VARIANT_COMPARE_AT_PRICE`, `VARIANT_INVENTORY`, `VARIANT_WEIGHT` (numeric — EQUALS/GREATER_THAN/LESS_THAN), `IS_PRICE_REDUCED` (IS_SET/IS_NOT_SET), `PRODUCT_TAXONOMY_NODE_ID` (EQUALS only), `PRODUCT_METAFIELD_DEFINITION`, `VARIANT_METAFIELD_DEFINITION` (metafield-based — use `ruleObject` to get the metafield definition).
- A non-existent collection ID or handle returns `null`, not an error.
- Fetch by handle: `collectionByHandle(handle: "summer-sale")` — **deprecated**. Use `collectionByIdentifier(identifier: { handle: "summer-sale" })` or `collectionByIdentifier(identifier: { id: "gid://shopify/Collection/123" })` instead.
- Products inside a collection can be sorted by `BEST_SELLING`, `TITLE`, `PRICE`, `CREATED`, `MANUAL`, `COLLECTION_DEFAULT` via `products(sortKey: BEST_SELLING)`.
- Publication status: `resourcePublicationsCount { count precision }` — requires `read_product_listings` scope.
