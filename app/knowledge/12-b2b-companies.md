## B2B Companies (read_companies / write_companies)

Companies are B2B business entities that purchase from the merchant (wholesale/B2B).

### List companies

```graphql
query {
  companies(first: 10) {
    nodes {
      id
      name
      externalId
      ordersCount
      totalSpent { amount currencyCode }
      createdAt
      updatedAt
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Filter arguments:**
- `query` — search by name, externalId, id, ordering_status, metafields, created_at, updated_at
- `sortKey` — `ID` (default), `NAME`, `CREATED_AT`, `UPDATED_AT`, `ORDERS_COUNT`, `TOTAL_SPENT`
- Standard pagination: `first`/`after`, `last`/`before`

**Useful query filters:**
- `name:Acme` — by company name
- `external_id:ERP-123` — by external ID
- `ordering_status:ENABLED` / `ordering_status:PAUSED`
- `id:gid://shopify/Company/123`

### Get a single company

```graphql
query {
  company(id: "gid://shopify/Company/426793626") {
    id
    name
    note
    externalId
    totalSpent { amount currencyCode }
    ordersCount { count }
    contactsCount { count }
    locationsCount { count }
    createdAt
    updatedAt
    customerSince
    lifetimeDuration
    mainContact { id }
  }
}
```

**Nested relationships available on Company:**
- `contacts(first, query)` — filter by email, role_name, status, company_location_id
- `locations(first, query)` — filter by name, external_id, ids
- `orders(first, sortKey)` — all orders across all locations
- `draftOrders(first, query)`
- `metafield(namespace, key)` / `metafields(first)` — companies support metafields

### Create a company

Can create company + contact + location in a single operation. `name` is required — omitting it returns a `REQUIRED` error.

```graphql
mutation {
  companyCreate(input: {
    company: { name: "Postal Cards Inc", externalId: "ERP-001" }
    companyContact: { email: "avery@example.com", firstName: "Avery", lastName: "Brown" }
    companyLocation: {
      name: "Ottawa Office"
      shippingAddress: { address1: "150 Elgin St", city: "Ottawa", zoneCode: "ON", zip: "K2P 1L4", countryCode: "CA" }
      billingSameAsShipping: true
    }
  }) {
    company { id name mainContact { id } locations(first: 1) { nodes { id name } } }
    userErrors { field message code }
  }
}
```

Shopify auto-creates two default contact roles: **"Location admin"** and **"Ordering only"**.

### List company locations (global)

`companyLocations` lists locations across all companies. Each location can have its own addresses, tax settings, `PaymentTerms`, and `Catalog`/price list assignments.

```graphql
query {
  companyLocations(first: 10) {
    nodes {
      id
      name
      externalId
      company { id name }
      billingAddress { address1 city countryCode }
      shippingAddress { address1 city countryCode }
      createdAt
      updatedAt
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Filter arguments:** `company_id`, `name`, `external_id`, `ids`, `created_at`, `updated_at`, metafields
**Sort keys:** `ID` (default), `NAME`, `CREATED_AT`, `UPDATED_AT`

Use `company.locations(first, query)` to scope locations to a single company.

### Update a location's address

`addressTypes` accepts `BILLING`, `SHIPPING`, or both.

```graphql
mutation {
  companyLocationAssignAddress(
    locationId: "gid://shopify/CompanyLocation/123"
    address: { address1: "150 Elgin St", city: "Ottawa", zoneCode: "ON", zip: "K2P 1L4", countryCode: "CA" }
    addressTypes: [SHIPPING, BILLING]
  ) {
    addresses { address1 city }
    userErrors { field message }
  }
}
```

### Get a company contact

A `CompanyContact` is a person who acts on behalf of a company. Each contact is linked to a `Customer` account and can be assigned roles per location.

```graphql
query {
  companyContact(id: "gid://shopify/CompanyContact/123") {
    id
    title
    locale
    isMainContact
    lifetimeDuration
    customer { id email firstName lastName }
    company { id name }
    roleAssignments(first: 5) {
      nodes { id }
    }
  }
}
```

**Key fields:** `title` (job title), `locale`, `isMainContact`, `customer` (linked Customer), `roleAssignments` (per-location roles).

### Create a company contact

Creates a contact and its linked `Customer` account in one step. Input: `email`, `firstName`, `lastName` (plus optional `title`, `locale`).

```graphql
mutation {
  companyContactCreate(
    companyId: "gid://shopify/Company/426793626"
    input: { email: "avery.brown@example.com", firstName: "Avery", lastName: "Brown" }
  ) {
    companyContact {
      id
      customer { id email firstName lastName }
      company { id name }
    }
    userErrors { field message code }
  }
}
```

### Update a company contact

Same `CompanyContactInput` as create: `email`, `firstName`, `lastName`, `title`, `locale`.

```graphql
mutation {
  companyContactUpdate(
    companyContactId: "gid://shopify/CompanyContact/456"
    input: { title: "Purchasing Manager" }
  ) {
    companyContact { id title }
    userErrors { field message }
  }
}
```

### Delete a company contact

```graphql
mutation {
  companyContactDelete(companyContactId: "gid://shopify/CompanyContact/456") {
    deletedCompanyContactId
    userErrors { field message }
  }
}
```

To delete multiple contacts at once: `companyContactsDelete(companyContactIds: [...])` — returns `deletedCompanyContactIds` and `userErrors`.

### Remove a contact from a company

`companyContactRemoveFromCompany` disassociates the contact from the company without deleting the underlying `Customer` record (unlike `companyContactDelete`).

```graphql
mutation {
  companyContactRemoveFromCompany(companyContactId: "gid://shopify/CompanyContact/456") {
    removedCompanyContactId
    userErrors { field message }
  }
}
```

### Assign roles to a contact

```graphql
mutation {
  companyContactAssignRole(
    companyContactId: "gid://shopify/CompanyContact/456"
    companyContactRoleId: "gid://shopify/CompanyContactRole/789"
    companyLocationId: "gid://shopify/CompanyLocation/101"
  ) {
    companyContactRoleAssignment { id }
    userErrors { field message }
  }
}
```

To revoke a role from a contact, use the role assignment ID (not the role ID):

```graphql
mutation {
  companyContactRevokeRole(
    companyContactId: "gid://shopify/CompanyContact/456"
    companyContactRoleAssignmentId: "gid://shopify/CompanyContactRoleAssignment/789"
  ) {
    revokedCompanyContactRoleAssignmentId
    userErrors { field message }
  }
}
```

To revoke multiple roles at once use `companyContactRevokeRoles(companyContactId, roleAssignmentIds: [...])` — or pass `revokeAll: true` to strip all roles in one call.

To assign multiple roles at once use `companyContactAssignRoles(companyContactId, rolesToAssign: [{ companyLocationId, companyContactRoleId }])` — returns `roleAssignments[]` and `userErrors`.

To assign the main contact for a company:

```graphql
mutation {
  companyAssignMainContact(companyId: "gid://shopify/Company/123", companyContactId: "gid://shopify/CompanyContact/456") {
    company { id mainContact { id } }
    userErrors { field message }
  }
}
```

A `CompanyContactRole` has `id`, `name` (e.g. `"admin"`, `"buyer"`), and optional `note`. Fetch by ID via `companyContactRole(id: ...)` or read inline from `company.contactRoles`.

### Delete a company address

Requires `write_customers` or `write_companies` scope. **Shopify Plus only.**

```graphql
mutation {
  companyAddressDelete(addressId: "gid://shopify/CompanyAddress/123") {
    deletedAddressId
    userErrors { field message }
  }
}
```

### Delete a company

```graphql
mutation {
  companyDelete(id: "gid://shopify/Company/123") {
    deletedCompanyId
    userErrors { field message }
  }
}
```

To delete multiple companies at once use `companiesDelete(companyIds: [...])` — returns `deletedCompanyIds`.

Both require `write_customers` or `write_companies` scope and **Shopify Plus**.

### Count companies

Requires `read_customers` or `read_companies` scope. **Shopify Plus only.** Capped at 10000 by default.

```graphql
query {
  companiesCount { count precision }
}
```

Pass `limit: null` to remove the cap. `precision` is `EXACT` or `AT_LEAST` when the true count exceeds the limit.