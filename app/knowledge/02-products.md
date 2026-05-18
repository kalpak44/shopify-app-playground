## Products & Collections (read_products / write_products)

### Products
- List: `query ListProducts { products(first: 50) { edges { node { id title status variants(first: 5) { edges { node { id title price sku inventoryQuantity } } } } } } }`
- Search: `products(first: 20, query: "title:*headphone* status:ACTIVE")`
- Create: `mutation CreateProduct { productCreate(input: { title, descriptionHtml, vendor, productType, tags, status }) { product { id } userErrors { field message } } }`
  - Products are created UNPUBLISHED by default. Call `publishablePublish` to make them live.
- Update: `mutation UpdateProduct { productUpdate(input: { id, title, descriptionHtml, tags }) { product { id } userErrors { field message } } }`
- Add variants to an existing product: `productVariantsBulkCreate(productId, variants: [{ price, compareAtPrice, optionValues: [{ name, optionId }] }])`
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
- Publish a product: `mutation PublishProduct { publishablePublish(id: "gid://shopify/Product/123", input: { publicationId: "gid://shopify/Publication/..." }) { ... } }`

### Collections / Categories
- "Categories" in Shopify are Collections. Two types: manual and smart (rule-based).
- List: `query ListCollections { collections(first: 50) { edges { node { id title productsCount { count } } } } }`
- Create manual: `mutation CreateCollection { collectionCreate(input: { title, descriptionHtml }) { collection { id } userErrors { field message } } }`
- Create smart (automated): include `ruleSet: { appliedDisjunctively: false, rules: [{ column: TAG, relation: EQUALS, condition: "sale" }] }` in the input.
- Add products to a manual collection: `mutation AddProducts { collectionAddProducts(id, productIds: [...]) { collection { id } userErrors { field message } } }`
- Update: `collectionUpdate(input: { id, title, descriptionHtml, ruleSet })`
