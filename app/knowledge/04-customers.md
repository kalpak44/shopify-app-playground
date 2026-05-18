## Customers (read_customers / write_customers)

### Customer — fields
- `id` (ID!)
- `displayName` (String!) — firstName + lastName, fallback email, fallback phone
- `firstName` (String)
- `lastName` (String)
- `email` (String) — ⚠️ DEPRECATED in 2026-04; use `defaultEmailAddress { emailAddress }`
- `defaultEmailAddress` (CustomerEmailAddress) — `{ emailAddress, marketingState (SUBSCRIBED | UNSUBSCRIBED | NOT_SUBSCRIBED | PENDING | INVALID | REDACTED) }`
- `phone` (String) — ⚠️ DEPRECATED in 2026-04; use `defaultPhoneNumber { phoneNumber }`
- `defaultPhoneNumber` (CustomerPhoneNumber) — `{ phoneNumber, marketingState }`
- `note` (String)
- `tags` ([String!]!)
- `state` (CustomerState) — `DECLINED | DISABLED | ENABLED | INVITED`
- `verifiedEmail` (Boolean!)
- `validEmailAddress` (Boolean!)
- `taxExempt` (Boolean!)
- `taxExemptions` ([TaxExemption!]!)
- `amountSpent` (MoneyV2!) — `{ amount currencyCode }` — lifetime total
- `numberOfOrders` (UnsignedInt64!)
- `lifetimeDuration` (String!) — human string like "2 years"
- `canDelete` (Boolean!) — false if customer has any orders
- `dataSaleOptOut` (Boolean!)
- `image` (Image!) — `{ url }`
- `defaultAddress` (MailingAddress) — `{ id firstName lastName address1 address2 city province zip country phone provinceCode countryCodeV2 }`
- `addresses(first, after, last, before, reverse)` (MailingAddressConnection)
- `orders(first, after, query, sortKey, reverse)` (OrderConnection)
- `companyContactProfiles` ([CompanyContact!]!) — B2B companies this customer is a contact for
- `mergeable` (CustomerMergeable) — `{ isMergeable reason }`
- `metafield(namespace, key)` / `metafields(first, namespace, keys)`
- `legacyResourceId` (UnsignedInt64!)
- `createdAt` (DateTime!)
- `updatedAt` (DateTime!)

### customers() — query arguments
- `first`, `after`, `last`, `before`, `reverse`
- `sortKey` — `CREATED_AT | ID | LAST_ORDER_DATE | LOCATION | NAME | RELEVANCE | UPDATED_AT`
- `query` — filter string

### customers() — query filters
- `id:1234`
- `email:<email>`
- `phone:<phone>`
- `name:<name>` — searches displayName
- `first_name:<name>` / `last_name:<name>`
- `tag:<tag>` / `tag_not:<tag>`
- `state:enabled` — `disabled | invited | enabled | declined`
- `created_at:>2024-01-01` / `updated_at:<2025-01-01`
- `orders_count:>0`
- `total_spent:>100`
- `country:<country_name>` / `province:<province>` / `city:<city>`

### CustomerInput — for create and update
- `id` (ID) — required for update, omit for create
- `firstName` (String)
- `lastName` (String)
- `email` (String)
- `phone` (String)
- `addresses` ([MailingAddressInput!])
- `note` (String)
- `tags` ([String!])
- `taxExempt` (Boolean)
- `taxExemptions` ([TaxExemption!])
- `metafields` ([MetafieldInput!])
- `emailMarketingConsent` (CustomerEmailMarketingConsentInput) — `{ marketingState (SUBSCRIBED | UNSUBSCRIBED | NOT_SUBSCRIBED), marketingOptInLevel (SINGLE_OPT_IN | CONFIRMED_OPT_IN | UNKNOWN), consentUpdatedAt (DateTime) }`
- `smsMarketingConsent` (CustomerSmsMarketingConsentInput) — same shape

### Mutations

**`customerCreate(input: CustomerInput!)`**
- Returns: `{ customer { id } userErrors { field message code } }`

**`customerUpdate(input: CustomerInput!)`** — `id` required in input
- Returns: `{ customer { id } userErrors { field message code } }`

**`customerDelete(input: { id: ID! })`**
- Returns: `{ deletedCustomerId userErrors { message } }`
- ⚠️ Fails if customer has any orders (`canDelete: false`)

**`customerMerge(customerId: ID!, customerIdToMerge: ID!)`** — async; requires `write_customer_merge` scope
- Returns: `{ job { id } customerMergeRequest { id resultingCustomer { id } } userErrors { field message } }`
- Poll: `customerMergeJobResult(jobId: ID!) { status done }`

**`customerGenerateAccountActivationUrl(customerId: ID!)`**
- Returns: `{ accountActivationUrl userErrors { message } }`

**`customerSendAccountInviteEmail(customerId: ID!)`**
- Returns: `{ customer { id } userErrors { message } }`

### Tag operations (no specific customer scope — any taggable resource)
**`tagsAdd(id: ID!, tags: [String!]!)`** — add tags to Customer, Product, Order, DraftOrder, etc.
- Returns: `{ node { id } userErrors { message } }`

**`tagsRemove(id: ID!, tags: [String!]!)`**
- Returns: `{ node { id } userErrors { message } }`