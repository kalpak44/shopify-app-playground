## Fulfillments (read_fulfillments / write_fulfillments)

The fulfillment model has two layers: **FulfillmentOrder** (what needs to be shipped, per location) and **Fulfillment** (what was actually shipped).

### FulfillmentOrder — fields
- `id` (ID!)
- `status` (FulfillmentOrderStatus) — `OPEN | IN_PROGRESS | INCOMPLETE | CLOSED | CANCELLED | SCHEDULED | ON_HOLD`
- `requestStatus` (FulfillmentOrderRequestStatus) — `UNSUBMITTED | SUBMITTED | ACCEPTED | REJECTED | CANCELLATION_REQUESTED | CANCELLATION_ACCEPTED | CANCELLATION_REJECTED | CLOSED`
- `assignedLocation` (FulfillmentOrderAssignedLocation) — `{ location { id name } address1 city countryCode }`
- `order` (Order!) — `{ id name }`
- `deliveryMethod` (FulfillmentOrderDeliveryMethod) — `{ methodType }` — `LOCAL | NONE | PICK_UP | RETAIL | SHIPPING | SHIPPING_FLAT_RATE | SHIPPING_BY_QUANTITY`
- `lineItems(first, after)` (FulfillmentOrderLineItemConnection) — `{ id remainingQuantity totalQuantity productTitle variant { id title sku } }`
- `fulfillments(first)` (FulfillmentConnection)
- `holdRequests(first)` (FulfillmentHoldConnection) — active holds
- `supportedActions` ([FulfillmentOrderSupportedAction!]!) — what transitions are allowed
- `createdAt` (DateTime!), `updatedAt` (DateTime!)

### Fulfillment — fields
- `id` (ID!)
- `name` (String!)
- `status` (FulfillmentStatus) — `PENDING | OPEN | SUCCESS | CANCELLED | ERROR | FAILURE`
- `displayStatus` (FulfillmentDisplayStatus) — `ATTEMPTED_DELIVERY | DELIVERED | FAILURE | IN_TRANSIT | LABEL_PRINTED | LABEL_PURCHASED | LABEL_VOIDED | MARKED_AS_FULFILLED | NOT_DELIVERED | OUT_FOR_DELIVERY | PICKED_UP | READY_FOR_PICKUP | SUBMITTED`
- `createdAt` (DateTime!), `updatedAt` (DateTime!)
- `order` (Order!)
- `location` (Location)
- `trackingInfo(first)` ([FulfillmentTrackingInfo!]) — `{ company number url }`
- `fulfillmentLineItems(first)` (FulfillmentLineItemConnection) — `{ id quantity lineItem { id title variant { id sku } } }`
- `service` (FulfillmentService)

### Getting fulfillment orders for an order
```graphql
order(id: "gid://shopify/Order/...") {
  fulfillmentOrders(first: 5) {
    edges { node {
      id status requestStatus
      assignedLocation { location { id name } }
      lineItems(first: 10) { edges { node { id remainingQuantity totalQuantity productTitle } } }
      deliveryMethod { methodType }
    } }
  }
}
```

### Mutations

**`fulfillmentCreateV2(fulfillment: FulfillmentV2Input!)`** — create a fulfillment (ship items)
- `FulfillmentV2Input`:
  - `lineItemsByFulfillmentOrder` ([FulfillmentOrderLineItemsInput!]!) — required
    - `FulfillmentOrderLineItemsInput`: `{ fulfillmentOrderId (ID!), fulfillmentOrderLineItems ([FulfillmentOrderLineItemInput!]) }` — omit `fulfillmentOrderLineItems` to fulfill ALL remaining items in that order
    - `FulfillmentOrderLineItemInput`: `{ id (ID!), quantity (Int!) }`
  - `notifyCustomer` (Boolean) — send shipping notification email
  - `trackingInfo` (FulfillmentTrackingInput) — `{ company (String), number (String), numbers ([String!]), url (String), urls ([String!]) }`
  - `locationId` (ID) — override location
- Returns: `{ fulfillment { id status trackingInfo { company number url } } userErrors { field message } }`

**`fulfillmentTrackingInfoUpdateV2(fulfillmentId: ID!, trackingInfoInput: FulfillmentTrackingInput!, notifyCustomer: Boolean)`**
- Returns: `{ fulfillment { id } userErrors { field message } }`

**`fulfillmentCancel(id: ID!)`** — cancel a fulfillment
- Returns: `{ fulfillment { id } userErrors { field message } }`

### FulfillmentOrder mutations

**`fulfillmentOrderMove(id: ID!, newLocationId: ID!)`** — reassign to a different location
- Returns: `{ movedFulfillmentOrder { id } remainingFulfillmentOrder { id } originalFulfillmentOrder { id } userErrors { field message } }`

**`fulfillmentOrderHold(fulfillmentOrderId: ID!, reason: FulfillmentHoldReason!, reasonNotes: String, notifyMerchant: Boolean, externalId: String)`**
- `reason`: `AWAITING_PAYMENT | HIGH_RISK_OF_FRAUD | INCORRECT_ADDRESS | INVENTORY_OUT_OF_STOCK | UNKNOWN_DELIVERY_DATE | OTHER`
- Returns: `{ fulfillmentHold { id reason } userErrors { field message } }`

**`fulfillmentOrderReleaseHold(id: ID!)`** — release a hold
- Returns: `{ fulfillmentOrder { id } userErrors { field message } }`

**`fulfillmentOrderClose(id: ID!, message: String)`** — close without creating a fulfillment (e.g. item cancelled)
- Returns: `{ fulfillmentOrder { id } userErrors { field message } }`

### For 3PL / fulfillment service apps (write_merchant_managed_fulfillment_orders or write_assigned_fulfillment_orders)

**`fulfillmentOrderAcceptFulfillmentRequest(id: ID!, message: String)`** — 3PL accepts a fulfillment request
- Returns: `{ fulfillmentOrder { id status } userErrors { field message } }`

**`fulfillmentOrderRejectFulfillmentRequest(id: ID!, message: String)`**
**`fulfillmentOrderSubmitFulfillmentRequest(id: ID!, message: String, notifyCustomer: Boolean, fulfillmentOrderLineItems: [FulfillmentOrderLineItemInput!])`** — merchant submits to 3PL

### Returns (read_returns / write_returns)

**`returnCreate(return: ReturnInput!)`**
- `ReturnInput`: `{ orderId (ID!), returnLineItems ([ReturnLineItemInput!]!), notifyCustomer (Boolean), requestedAt (DateTime) }`
- `ReturnLineItemInput`: `{ fulfillmentLineItemId (ID!), quantity (Int!), returnReason (ReturnReason!), customerNote (String) }`
- `ReturnReason`: `UNKNOWN | FINAL_SALE | SIZE_TOO_SMALL | SIZE_TOO_LARGE | WRONG_ITEM | NOT_AS_DESCRIBED | DEFECTIVE | STYLE | COLOR | UNWANTED | OTHER`
- Returns: `{ return { id status } userErrors { field message } }`

**`returnApprove(input: { id: ID! })`** / **`returnDecline(input: { id: ID!, declineReason: ReturnDeclineReason! })`**
**`returnRefund(returnRefundInput: ReturnRefundInput!)`** — issue a refund as part of return
**`returnClose(id: ID!)`** / **`returnReopen(id: ID!)`**

## Shipping Profiles (read_shipping / write_shipping)

- List: `deliveryProfiles(first: 10) { edges { node { id name } } }`
- Get: `deliveryProfile(id: "gid://shopify/DeliveryProfile/...") { id name profileItems(first: 10) { edges { node { product { id title } } } } profileLocationGroups { locationGroup { locations(first: 5) { edges { node { id name } } } } } }`
- Detailed delivery profile docs are in `17-delivery-profiles.md`