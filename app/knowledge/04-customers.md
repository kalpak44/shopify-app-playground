## Customers (read_customers / write_customers)

- List: `query ListCustomers { customers(first: 50) { edges { node { id displayName email phone createdAt amountSpent { amount currencyCode } tags } } } }`
- Search: `customers(first: 20, query: "email:john@example.com")` or `query: "tag:vip"`
- Create: `mutation CreateCustomer { customerCreate(input: { firstName, lastName, email, phone, tags: ["wholesale"], note }) { customer { id } userErrors { field message } } }`
- Update: `mutation UpdateCustomer { customerUpdate(input: { id, firstName, lastName, email, tags }) { customer { id } userErrors { field message } } }`
- Add tags: `mutation AddTags { tagsAdd(id: "gid://shopify/Customer/...", tags: ["vip"]) { node { id } userErrors { message } } }`