## Orders (read_orders / write_orders)

> ⚠️ Only the last 60 days of orders are accessible by default. Older orders require the `read_all_orders` scope.

### Order — fields
- `id` (ID!)
- `name` (String!) — display name like "#1001"
- `confirmationNumber` (String) — customer-facing confirmation number
- `createdAt` (DateTime!)
- `updatedAt` (DateTime!)
- `processedAt` (DateTime!)
- `closedAt` (DateTime) — set when closed
- `cancelledAt` (DateTime) — set when cancelled
- `cancelReason` (OrderCancelReason) — `CUSTOMER | DECLINED | FRAUD | INVENTORY | OTHER | STAFF`
- `closed` (Boolean!)
- `confirmed` (Boolean!) — inventory reserved
- `capturable` (Boolean!) — authorized payment can be captured
- `canMarkAsPaid` (Boolean!)
- `displayFinancialStatus` (OrderDisplayFinancialStatus) — `AUTHORIZED | EXPIRED | PAID | PARTIALLY_PAID | PARTIALLY_REFUNDED | PENDING | REFUNDED | VOIDED`
- `displayFulfillmentStatus` (OrderDisplayFulfillmentStatus) — `FULFILLED | IN_PROGRESS | ON_HOLD | OPEN | PARTIALLY_FULFILLED | PENDING_FULFILLMENT | RESTOCKED | SCHEDULED | UNFULFILLED`
- `financialStatus` (OrderFinancialStatus) — same values minus display-only ones
- `email` (String)
- `phone` (String)
- `note` (String)
- `tags` ([String!]!)
- `currencyCode` (CurrencyCode!)
- `customer` (Customer) — `{ id displayName email }`
- `billingAddress` (MailingAddress) — `{ firstName lastName address1 city province zip country phone countryCodeV2 }`
- `shippingAddress` (MailingAddress) — same shape
- `totalPriceSet` (MoneyBag!) — `{ shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }`
- `subtotalPriceSet` (MoneyBag!)
- `totalTaxSet` (MoneyBag!)
- `totalDiscountsSet` (MoneyBag!)
- `totalShippingPriceSet` (MoneyBag!)
- `totalRefundedSet` (MoneyBag!)
- `currentSubtotalPriceSet` (MoneyBag!) — after returns/exchanges
- `currentTotalPriceSet` (MoneyBag!) — after returns/exchanges
- `lineItems(first, after, reverse)` (LineItemConnection) — `{ id title quantity sku variant { id } originalTotalSet discountedTotalSet }`
- `shippingLines(first)` (ShippingLineConnection) — `{ id title code discountedPriceSet }`
- `refunds` ([Refund!]!) — `{ id createdAt note }`
- `transactions(first, manualTransactions)` ([OrderTransaction!]!) — `{ id status kind gateway amount }`
- `fulfillmentOrders(first, after, displayable)` (FulfillmentOrderConnection)
- `discountCodes` ([String!]!)
- `discountApplications(first)` (DiscountApplicationConnection)
- `metafield(namespace, key)` / `metafields(first, namespace, keys)`
- `channelInformation` (ChannelInformation) — `{ channelDefinition { handle } }`
- `legacyResourceId` (UnsignedInt64!)

### orders() — query arguments
- `first`, `after`, `last`, `before`, `reverse` (Boolean, default false)
- `sortKey` — `CREATED_AT | ID | PROCESSED_AT | UPDATED_AT | TOTAL_PRICE | RELEVANCE`
- `query` — filter string (see below)

### orders() — query filters
- `financial_status:paid` — `pending | authorized | partially_paid | paid | partially_refunded | refunded | voided`
- `fulfillment_status:unshipped` — `shipped | unshipped | partial | any | unfulfilled`
- `status:open` — `open | closed | any | cancelled`
- `created_at:>2024-01-01` / `updated_at:<2025-01-01` / `processed_at:>2024-06-01` / `closed_at:>2024-01-01`
- `customer_id:<legacyId>` — filter by customer (use legacy integer ID, not GID)
- `email:<email>`
- `tag:<tag>` / `tag_not:<tag>`
- `source_name:web` — `web | shopify_draft_order | <app-name>`
- `test:true` — test orders only
- `sku:<sku>` — has line item with this SKU
- `gateway:<gateway>` — payment gateway name
- `return_status:no_return` — `no_return | return_requested | return_in_progress | returned`
- `id:>=1234` / `id:1234`

### Mutations

**`orderUpdate(input: OrderInput!)`** — update metadata; does NOT change line items
- `OrderInput`: `{ id (ID!), note (String), email (String), phone (String), tags ([String!]), shippingAddress (MailingAddressInput), customAttributes ([AttributeInput]), metafields ([MetafieldInput]), taxExempt (Boolean) }`
- Returns: `{ order { id } userErrors { field message } }`

**`orderCancel(orderId: ID!, reason: OrderCancelReason!, refund: Boolean!, restock: Boolean!, notifyCustomer: Boolean, staffNote: String)`**
- `reason`: `CUSTOMER | DECLINED | FRAUD | INVENTORY | OTHER | STAFF`
- Returns: `{ order { id } userErrors { field message } }`

**`orderClose(input: { id: ID! })`** — close an open order
- Returns: `{ order { id } userErrors { field message } }`

**`orderOpen(input: { id: ID! })`** — reopen a closed order

**`orderMarkAsPaid(input: { id: ID! })`** — manually mark as paid (pending → paid)
- Returns: `{ order { id } userErrors { field message } }`

**`orderCapture(input: { id: ID!, amount: Money!, currency: CurrencyCode!, parentTransactionId: ID! })`** — capture an authorized payment
- Returns: `{ transaction { id status } userErrors { field message } }`

**`refundCreate(input: RefundInput!)`** — create a refund
- `RefundInput`: `{ orderId (ID!), note (String), notify (Boolean), currency (CurrencyCode), refundLineItems ([RefundLineItemInput]), refundMethods ([RefundMethodInput]), shipping (ShippingRefundInput), transactions ([OrderTransactionInput]), processedAt (DateTime) }`
- `RefundLineItemInput`: `{ lineItemId (ID!), quantity (Int!), restockType (NO_RESTOCK | CANCEL | RETURN | LEGACY_RESTOCK), locationId (ID) }`
- Returns: `{ refund { id } userErrors { field message } }`

**`orderInvoiceSend(id: ID!)`** — send invoice email
- Returns: `{ order { id } userErrors { field message } }`

### Draft Orders (read_draft_orders / write_draft_orders)

**DraftOrder fields:**
- `id` (ID!), `name` (String!), `status` (DraftOrderStatus) — `OPEN | COMPLETED | INVOICE_SENT`
- `invoiceUrl` (URL) — shareable checkout link
- `order` (Order) — set once completed
- `email` (String), `phone` (String), `note` (String), `tags` ([String!]!)
- `totalPrice` (Money!), `subtotalPrice` (Money!), `taxExempt` (Boolean!)
- `customer` (Customer), `billingAddress` (MailingAddress), `shippingAddress` (MailingAddress)
- `lineItems(first)` — `{ id title quantity originalUnitPrice variant { id } }`
- `completedAt` (DateTime), `createdAt` (DateTime!), `updatedAt` (DateTime!)

**`draftOrders(first, after, query, sortKey, reverse)`** — list draft orders
- `sortKey`: `ID | UPDATED_AT | STATUS | TOTAL_PRICE | CUSTOMER_NAME | NUMBER`
- `query` filters: `status:open|completed|invoice_sent`, `created_at`, `updated_at`, `id`, `customer_id`, `email`

**`draftOrderCreate(input: DraftOrderInput!)`** — create draft order
- `DraftOrderInput`: `{ lineItems ([DraftOrderLineItemInput!]), email, phone, billingAddress (MailingAddressInput), shippingAddress (MailingAddressInput), note, tags, appliedDiscount (DraftOrderAppliedDiscountInput), customAttributes ([AttributeInput]), reserveInventoryUntil (DateTime), visibleToCustomer (Boolean), sourceIdentifier (String) }`
- `DraftOrderLineItemInput`: `{ variantId (ID), title (String — custom item), originalUnitPrice (Money — custom), quantity (Int!), sku, requiresShipping, taxable, giftCard, appliedDiscount, customAttributes }`
- Returns: `{ draftOrder { id invoiceUrl } userErrors { field message } }`

**`draftOrderUpdate(id: ID!, input: DraftOrderInput!)`**
**`draftOrderComplete(id: ID!, paymentPending: Boolean)`** — converts draft to order; returns `{ draftOrder { order { id } } userErrors }`
**`draftOrderDelete(input: { id: ID! })`** — returns `{ deletedId userErrors }`
**`draftOrderSendInvoice(id: ID!, email: DraftOrderInvoiceEmailInput!)`** — `email: { to, from, bcc, subject, customMessage }`
**`draftOrderCalculate(input: DraftOrderInput!)`** — preview totals without persisting; returns `{ calculatedDraftOrder { totalPrice subtotalPrice taxLines } }`