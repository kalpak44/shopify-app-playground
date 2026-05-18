## Catalogs & Price Lists (read_products / write_products)

A Catalog is a list of products with publishing and pricing information tied to a context.

**Catalog types:**
- `MarketCatalog` — market-specific availability
- `CompanyLocationCatalog` — B2B per-location pricing
- `AppCatalog` — app-managed catalog

**Catalog fields:** `id`, `title`, `status` (`ACTIVE`, etc.), `priceList`, `publication`, `operations`

### Delete a catalog

```graphql
mutation {
  catalogDelete(id: "gid://shopify/Catalog/123", deleteDependentResources: true) {
    deletedId
    userErrors { field message }
  }
}
```

`deleteDependentResources: true` also deletes the catalog's owned price list and publication (default: `false`).

### Update catalog contexts

Add or remove which markets or B2B company locations can access a catalog. Requires `write_products`.

```graphql
mutation {
  catalogContextUpdate(
    catalogId: "gid://shopify/Catalog/123"
    contextsToAdd: { companyLocationIds: ["gid://shopify/CompanyLocation/456"] }
    contextsToRemove: { marketIds: ["gid://shopify/Market/789"] }
  ) {
    catalog { id title status }
    userErrors { field message }
  }
}
```

`CatalogContextInput` accepts `companyLocationIds` and/or `marketIds`.

### List catalogs

```graphql
query {
  catalogs(first: 10, type: COMPANY_LOCATION) {
    nodes { id title status }
    pageInfo { hasNextPage endCursor }
  }
}
```

Count catalogs: `catalogsCount(type, query, limit)` — same filters as the list query; returns `{ count, precision }`. Pass `limit: null` to remove the 10000 cap.

**`type` filter:** `MARKET`, `COMPANY_LOCATION`, `APP` (omit for all types)
**`query` filters:** `title`, `status`, `company_id`, `company_location_id`, `market_id`, `app_id`
**`status` values:** `ACTIVE`, `DRAFT`, `ARCHIVED`

### Fetch a catalog by ID

```graphql
query {
  catalog(id: "gid://shopify/Catalog/123") {
    id
    title
    status
    priceList { id currency }
    publication { id }
    operations {
      __typename
      ... on CatalogCsvOperation { id status }
    }
  }
}
```

- `priceList` — optional; sets currency and pricing rules for this catalog's context
- `publication` — controls which products are visible; if absent, visibility follows the sales channel
- `operations` — async history (e.g., CSV imports); check `status` field on each operation

### List all recent catalog operations (shop-wide)

Requires `read_products` or `read_publications`. Returns most recent operations across all catalogs.

```graphql
query {
  catalogOperations {
    id
    status
    processedRowCount
    rowCount { count precision }
  }
}
```

`ResourceOperationStatus` values: `ACTIVE`, `COMPLETE`, `FAILED`, `INACTIVE`, `PENDING`.

### Create a price list

Requires `write_products`. The price list must be linked to a `Catalog` to take effect for customers.

```graphql
mutation PriceListCreate($input: PriceListCreateInput!) {
  priceListCreate(input: $input) {
    priceList {
      id
      name
      currency
      parent { adjustment { type value } }
    }
    userErrors { field message }
  }
}
```

Variables: `{ "input": { "name": "EU Price List", "currency": "EUR", "parent": { "adjustment": { "type": "PERCENTAGE_DECREASE", "value": 10 } } } }`

**`PriceListCreateInput` fields:**
- `name` — unique name
- `currency` — ISO currency code for fixed prices
- `parent.adjustment.type` — `PERCENTAGE_INCREASE`, `PERCENTAGE_DECREASE`, or `FIXED_AMOUNT`
- `parent.adjustment.value` — magnitude of the adjustment

After creation, link the price list to a catalog and set per-variant fixed prices via `priceListFixedPricesAdd`.

### Set fixed prices on a price list

Requires `write_products`. Upserts per-variant fixed prices that override the price list's percentage adjustment. Replaces any existing fixed price for the same variant.

```graphql
mutation priceListFixedPricesAdd($priceListId: ID!, $prices: [PriceListPriceInput!]!) {
  priceListFixedPricesAdd(priceListId: $priceListId, prices: $prices) {
    prices {
      price { amount currencyCode }
      compareAtPrice { amount currencyCode }
    }
    userErrors { field code message }
  }
}
```

Variables: `{ "priceListId": "gid://shopify/PriceList/123", "prices": [{ "variantId": "gid://shopify/ProductVariant/456", "price": { "amount": "29.99", "currencyCode": "CAD" }, "compareAtPrice": { "amount": "39.99", "currencyCode": "CAD" } }] }`

⚠️ All prices in the batch must use the same currency as the price list — mismatches return `PRICE_LIST_CURRENCY_MISMATCH` userError.

To set the same price for **all variants of a product** at once, use `priceListFixedPricesByProductUpdate` instead:

```graphql
mutation {
  priceListFixedPricesByProductUpdate(
    priceListId: "gid://shopify/PriceList/123"
    pricesToAdd: [{ productId: "gid://shopify/Product/456", price: { amount: "29.99", currencyCode: "CAD" }, compareAtPrice: { amount: "39.99", currencyCode: "CAD" } }]
    pricesToDeleteByProductIds: ["gid://shopify/Product/789"]
  ) {
    priceList { id }
    userErrors { field message }
  }
}
```

- `pricesToAdd` — `PriceListProductPriceInput`: `productId`, `price`, optional `compareAtPrice`; all variants receive the same price
- `pricesToDeleteByProductIds` — removes fixed prices for all variants of those products; they revert to the adjustment rule
- Both arrays can be used in the same call

To remove fixed prices by **variant** (reverting to adjustment rule), use `priceListFixedPricesDelete`:

```graphql
mutation priceListFixedPricesDelete($priceListId: ID!, $variantIds: [ID!]!) {
  priceListFixedPricesDelete(priceListId: $priceListId, variantIds: $variantIds) {
    deletedFixedPriceVariantIds
    userErrors { field code message }
  }
}
```

Returns `deletedFixedPriceVariantIds` — variant GIDs whose fixed prices were removed.

### Update a price list

Requires `write_products`. Same fields as create; partial updates are supported.

```graphql
mutation priceListUpdate($id: ID!, $input: PriceListUpdateInput!) {
  priceListUpdate(id: $id, input: $input) {
    priceList { id name currency parent { adjustment { type value } } }
    userErrors { field code message }
  }
}
```

⚠️ Changing `currency` **removes all fixed prices** from the price list — affected variants revert to the adjustment rule.

### Delete a price list

Requires `write_products`.

```graphql
mutation priceListDelete($id: ID!) {
  priceListDelete(id: $id) {
    deletedId
    userErrors { field code message }
  }
}
```

Returns `deletedId` on success.

### Fetch a price list by ID

```graphql
query {
  priceList(id: "gid://shopify/PriceList/123") {
    id
    name
    currency
    fixedPricesCount
    catalog { id title }
    parent {
      adjustment { type value }
    }
    prices(first: 10, originType: FIXED) {
      nodes {
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        originType
        variant { id }
      }
    }
    quantityRules(first: 10, originType: FIXED) {
      nodes {
        minimum
        maximum
        increment
        productVariant { id title }
      }
    }
  }
}
```

- `parent.adjustment.type` — e.g. `PERCENTAGE_DECREASE`, `PERCENTAGE_INCREASE`, `FIXED_AMOUNT`; `value` is the magnitude
- `prices(originType: FIXED)` — only explicitly set prices; `RELATIVE` for computed adjustments
- `prices(query: "product_id:123")` / `prices(query: "variant_id:456")` — filter prices to a specific product or variant
- `quantityRules(originType: FIXED)` — B2B minimum/maximum/increment rules set on this price list; omit `originType` for all rules