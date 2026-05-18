## Discounts (read_discounts / write_discounts)

Discounts come in two categories: **code** (customer must enter a code) and **automatic** (apply automatically). Each category has three types: Basic (fixed/percentage), BxGy (buy X get Y), and FreeShipping.

### Querying discounts

**Code discounts:**
```graphql
discountNodes(first: 20, query: "status:ACTIVE") {
  edges { node {
    id
    discount {
      ... on DiscountCodeBasic { title status startsAt endsAt usageLimit appliesOncePerCustomer asyncUsageCount }
      ... on DiscountCodeBxgy  { title status }
      ... on DiscountCodeFreeShipping { title status }
    }
  } }
}
```

**Automatic discounts:**
```graphql
automaticDiscountNodes(first: 20) {
  edges { node {
    id
    automaticDiscount {
      ... on DiscountAutomaticBasic { title status startsAt endsAt shortSummary }
      ... on DiscountAutomaticBxgy  { title status }
      ... on DiscountAutomaticFreeShipping { title status }
    }
  } }
}
```

`discountNodes` / `automaticDiscountNodes` — query filters: `status:ACTIVE|EXPIRED|SCHEDULED`, `title:<title>`, `created_at`, `updated_at`

**Single lookup:** `discountNode(id: "gid://shopify/DiscountCodeNode/...")` / `automaticDiscountNode(id: "gid://shopify/DiscountAutomaticNode/...")`

### Shared nested types

**`customerGets`** — what the discount applies to and its value:
```graphql
customerGets {
  value {
    ... on DiscountPercentage { percentage }         # e.g. 0.15 = 15%
    ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem }
  }
  items {
    ... on AllDiscountItems { allItems }             # all products
    ... on DiscountProducts { productsCount { count } products { nodes { id } } }
    ... on DiscountCollections { collectionsCount { count } collections { nodes { id } } }
  }
}
```

**`customerSelection`** — who can use the discount (code discounts only):
```graphql
customerSelection {
  ... on DiscountCustomerAll { allCustomers }
  ... on DiscountCustomerSegments { segments { nodes { id name } } }
  ... on DiscountCustomers { customers { nodes { id displayName } } }
}
```

**`minimumRequirement`**:
```graphql
minimumRequirement {
  ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
  ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } }
}
```

**`combinesWith`** (DiscountCombinesWith) — `{ orderDiscounts productDiscounts shippingDiscounts }` (all Boolean)

### DiscountCodeBasic fields
- `title` (String!) / `status` (DiscountStatus — `ACTIVE | EXPIRED | SCHEDULED`)
- `startsAt` (DateTime!) / `endsAt` (DateTime)
- `usageLimit` (Int) — null = unlimited
- `appliesOncePerCustomer` (Boolean!)
- `asyncUsageCount` (Int!) — total redemptions
- `codes(first)` — `{ nodes { code } }` — the actual redemption codes
- `codesCount` (Count) — `{ count }`
- `customerGets` / `customerSelection` / `minimumRequirement` / `combinesWith`

### DiscountAutomaticBasic fields
- `title` (String!) / `status` / `startsAt` / `endsAt`
- `shortSummary` (String!) — e.g. "15% off"
- `summary` (String!)
- `customerGets` / `minimumRequirement` / `combinesWith`

### DiscountCodeBxgy / DiscountAutomaticBxgy — additional fields
- `customerBuys` — same inline-fragment structure as `customerGets`; specifies what must be purchased
- `usesPerOrderLimit` (Int) — how many times per order the BxGy applies

### DiscountCodeFreeShipping / DiscountAutomaticFreeShipping — additional fields
- `destinationSelection` — `{ ... on DiscountCountries { countries restOfWorld } ... on DiscountCountryAll { allCountries } }`
- `maximumShippingPrice` (MoneyV2)
- `minimumRequirement`

### Mutations — Code discounts

**`discountCodeBasicCreate(codeBasicDiscount: DiscountCodeBasicInput!)`**
- `DiscountCodeBasicInput`: `{ title (String!), code (String!), startsAt (DateTime!), endsAt (DateTime), usageLimit (Int), appliesOncePerCustomer (Boolean), customerGets (DiscountCustomerGetsInput!), customerSelection (DiscountCustomerSelectionInput), minimumRequirement (DiscountMinimumRequirementInput), combinesWith (DiscountCombinesWithInput) }`
- Returns: `{ codeDiscountNode { id } userErrors { field message code } }`

**`discountCodeBasicUpdate(id: ID!, codeBasicDiscount: DiscountCodeBasicInput!)`**
- Returns: `{ codeDiscountNode { id } userErrors { field message } }`

**`discountCodeBasicDelete(id: ID!)`**
- Returns: `{ deletedCodeDiscountId userErrors { field message } }`

**`discountCodeActivate(id: ID!)`** / **`discountCodeDeactivate(id: ID!)`**
- Returns: `{ codeDiscountNode { id } userErrors { field message } }`

**`discountRedeemCodeBulkAdd(discountId: ID!, codes: [DiscountRedeemCodeInput!]!)`** — add multiple codes to one discount
- `DiscountRedeemCodeInput`: `{ code (String!) }`
- Returns: `{ bulkCreation { id } userErrors { field message } }`

### Mutations — Automatic discounts

**`discountAutomaticBasicCreate(automaticBasicDiscount: DiscountAutomaticBasicInput!)`**
- `DiscountAutomaticBasicInput`: `{ title (String!), startsAt (DateTime!), endsAt (DateTime), customerGets (DiscountCustomerGetsInput!), minimumRequirement (DiscountMinimumRequirementInput), combinesWith (DiscountCombinesWithInput) }`
- Returns: `{ automaticDiscountNode { id } userErrors { field message } }`

**`discountAutomaticBasicUpdate(id: ID!, automaticBasicDiscount: DiscountAutomaticBasicInput!)`**
**`discountAutomaticBasicDelete(id: ID!)`** — returns `{ deletedAutomaticDiscountId userErrors }`
**`discountAutomaticActivate(id: ID!)`** / **`discountAutomaticDeactivate(id: ID!)`**

### Input helper shapes

**`DiscountCustomerGetsInput`:**
```
{ value: { percentage: Float } | { discountAmount: { amount: Money!, appliesOnEachItem: Boolean } },
  items: { all: Boolean } | { products: { productsToAdd: [ID!] } } | { collections: { add: [ID!] } } }
```

**`DiscountCustomerSelectionInput`:**
```
{ all: Boolean } | { customers: { add: [ID!] } } | { customerSegments: { add: [ID!] } }
```

**`DiscountMinimumRequirementInput`:**
```
{ quantity: { greaterThanOrEqualToQuantity: UnsignedInt64! } }
| { subtotal: { greaterThanOrEqualToSubtotal: Decimal! } }
```

### Price Rules (read_price_rules / write_price_rules)
Legacy API — still functional. Use `priceRules(first: 20)` to list. Prefer the Discounts API above for all new work.