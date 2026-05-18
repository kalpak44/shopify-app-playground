## Orders (read_orders / write_orders)

- List: `query ListOrders { orders(first: 50, sortKey: PROCESSED_AT, reverse: true) { edges { node { id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet { shopMoney { amount currencyCode } } customer { displayName email } lineItems(first: 10) { edges { node { name quantity sku } } } } } pageInfo { hasNextPage endCursor } } }`
- Filter by date: `orders(first: 50, query: "created_at:>2024-06-01 created_at:<2024-07-01")`
- Filter by status: `orders(first: 50, query: "financial_status:paid fulfillment_status:unfulfilled")`
- Key fields: `displayFinancialStatus` (PAID, PENDING, REFUNDED…), `displayFulfillmentStatus` (FULFILLED, UNFULFILLED, PARTIAL…), `totalPriceSet.shopMoney.amount`

## Draft Orders (read_draft_orders / write_draft_orders)

- List: `query ListDraftOrders { draftOrders(first: 20) { edges { node { id name status createdAt totalPrice customer { email } } } } }`
- Filter: `draftOrders(first: 20, query: "created_at:>2024-01-01")`
- Create: `mutation CreateDraftOrder { draftOrderCreate(input: { lineItems: [{ variantId, quantity }], email, shippingAddress: { ... }, note }) { draftOrder { id invoiceUrl } userErrors { field message } } }`