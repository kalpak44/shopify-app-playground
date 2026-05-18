## Fulfillments (read_fulfillments / write_fulfillments)

- Get fulfillment orders for an order: `order(id) { fulfillmentOrders(first: 5) { edges { node { id status lineItems(first: 10) { edges { node { id remainingQuantity } } } assignedLocation { location { id name } } } } } }`
- Create fulfillment: `mutation CreateFulfillment { fulfillmentCreateV2(fulfillment: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId, fulfillmentOrderLineItems: [{ id, quantity }] }] }) { fulfillment { id status } userErrors { field message } } }`

## Shipping (read_shipping / write_shipping)

- List delivery profiles: `query ListProfiles { deliveryProfiles(first: 10) { edges { node { id name } } } }`
- Most shipping edits are done through delivery profiles and zones.