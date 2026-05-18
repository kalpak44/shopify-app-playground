## Inventory (read_inventory / write_inventory)

⚠️ **Removed/nonexistent fields — never use these:**
- `InventoryLevel.available` — does NOT exist. Use `quantities(names: ["available"]) { name quantity }`.
- `InventoryLevel.availableQuantity` — does NOT exist. Same fix.
- `InventoryLevel.quantity` — does NOT exist as a direct field. Same fix.
- `InventoryLevel.inventoryItem` — does NOT exist. The link from a level to its item is `InventoryLevel.item` (not `inventoryItem`).
- `InventoryItem.available` — does NOT exist. Use `inventoryLevels` with `quantities`.

### InventoryItem fields (2026-04)
- `id`, `sku`, `tracked` (Boolean — whether quantities are tracked), `trackedEditable`
- `requiresShipping`, `measurement` (packaging dimensions)
- `unitCost` — MoneyV2 (requires "View product costs" permission)
- `countryCodeOfOrigin`, `provinceCodeOfOrigin`, `harmonizedSystemCode`, `countryHarmonizedSystemCodes`
- `duplicateSkuCount`, `locationsCount`, `inventoryHistoryUrl`
- `inventoryLevel(locationId: ID!, includeInactive: Boolean)` — single level at one location
- `inventoryLevels(first, after, last, before, reverse, includeInactive, query)` — all levels; `query` supports `id`, `inventory_item_id`, `inventory_group_id`, `created_at`, `updated_at`
- `variants(first, after, last, before)` — variants that reference this item
- `variant` — **DEPRECATED**; use `variants(first: 1)` instead
- `createdAt`, `updatedAt`, `legacyResourceId`

### Valid quantity names for `quantities(names: [...])`
All 8 states: `"available"`, `"committed"`, `"incoming"`, `"on_hand"`, `"reserved"`, `"damaged"`, `"quality_control"`, `"safety_stock"`

### InventoryLevel fields (2026-04)
- `id` — compound GID format: `"gid://shopify/InventoryLevel/523463154?inventory_item_id=30322695"`
- `item` (InventoryItem!) — the inventory item at this level
- `location` (Location!) — the location
- `quantities(names: [String!]!)` — required `names` argument; returns `[{ name quantity }]`
- `isActive` (Boolean!) — whether the level is active
- `canDeactivate` (Boolean!) — whether it can be deactivated
- `deactivationAlert` (String) — explains deactivation impact or why it can't be deactivated
- `createdAt`, `updatedAt`
- `scheduledChanges` — **DEPRECATED**

### Correct InventoryLevel shape
```graphql
inventoryLevels(first: 10) {
  edges {
    node {
      id
      isActive
      location { id name }
      item { id sku tracked }
      quantities(names: ["available", "on_hand", "committed", "incoming", "reserved", "damaged", "quality_control", "safety_stock"]) { name quantity }
    }
  }
}
```

- Lookup a single level by ID: `inventoryLevel(id: "gid://shopify/InventoryLevel/523463154?inventory_item_id=30322695") { ... }` — note the compound ID format with `?inventory_item_id=` query string

### Common patterns
- Get inventory for a variant: `productVariant(id) { inventoryItem { id tracked sku } }`
- List all inventory items (shop-wide): `inventoryItems(first, after, last, before, reverse, query)` — `query` filters: `id`, `sku`, `created_at`, `updated_at`
  - By SKU: `inventoryItems(first: 1, query: "sku:'element-151'")` — note single quotes around the value
  - By ID range: `inventoryItems(first: 20, query: "id:>=30322695")`
  - Combined: `inventoryItems(first: 10, query: "(created_at:>2023-10-10) OR (sku:'element-151')")`
- Single item by ID: `inventoryItem(id: "gid://shopify/InventoryItem/...")`
- List inventory levels across all locations:
  ```graphql
  query GetInventoryLevels {
    inventoryItem(id: "gid://shopify/InventoryItem/...") {
      id
      tracked
      inventoryLevels(first: 10) {
        edges {
          node {
            id
            location { id name }
            quantities(names: ["available", "on_hand", "committed", "incoming", "reserved"]) { name quantity }
          }
        }
      }
    }
  }
  ```
- Single location lookup: `inventoryItem(id) { inventoryLevel(locationId: "gid://shopify/Location/...") { quantities(names: ["available"]) { name quantity } } }`
- Adjust quantity (delta, not absolute): `mutation AdjustInventory { inventoryAdjustQuantities(input: { reason: "correction", name: "available", changes: [{ delta: 10, inventoryItemId: "gid://shopify/InventoryItem/...", locationId: "gid://shopify/Location/..." }] }) { inventoryAdjustmentGroup { reason changes { name delta } } userErrors { field message } } }`
- Set absolute quantity: use `inventorySetQuantities` with `quantities: [{ inventoryItemId, locationId, quantity, name: "available" }]`

### ⚠️ Idempotency requirement (2026-04)
As of 2026-04, the `@idempotent` directive with a unique key is **required** on all inventory mutation calls. Pass a UUID as the key:
```graphql
mutation inventoryActivate(...) @idempotent(key: $idempotencyKey) { ... }
```
Without `@idempotent`, the mutation will error in 2026-04+.

### Inventory mutations

**`inventoryActivate`** (`write_inventory`) — Connect an inventory item to a location, creating an InventoryLevel. Sets initial quantities.
```graphql
mutation inventoryActivate($inventoryItemId: ID!, $locationId: ID!, $available: Int, $key: String!) {
  inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) @idempotent(key: $key) {
    inventoryLevel { id quantities(names: ["available"]) { name quantity } }
    userErrors { field message }
  }
}
```
- `available` (Int) — initial available qty (default 0)
- `onHand` (Int) — initial on-hand qty (default 0)
- `stockAtLegacyLocation` (Boolean, default false) — allow activation at fulfillment service location

**`inventoryDeactivate`** (`write_inventory`) — Remove inventory from a location by `inventoryLevelId`.
```graphql
mutation { inventoryDeactivate(inventoryLevelId: "gid://shopify/InventoryLevel/...?inventory_item_id=...") { userErrors { message } } }
```

**`inventoryBulkToggleActivation`** (`write_inventory`) — Activate or deactivate an inventory item at multiple locations in one call.
```graphql
mutation inventoryBulkToggleActivation($inventoryItemId: ID!, $inventoryItemUpdates: [InventoryBulkToggleActivationInput!]!) {
  inventoryBulkToggleActivation(inventoryItemId: $inventoryItemId, inventoryItemUpdates: $inventoryItemUpdates) {
    inventoryItem { id }
    inventoryLevels { id quantities(names: ["available"]) { name quantity } location { id } }
    userErrors { field message code }
  }
}
# inventoryItemUpdates: [{ locationId: "gid://shopify/Location/...", activate: true|false }]
```

**`inventoryItemUpdate`** (`write_inventory`) — Update InventoryItem properties.
- Input fields: `cost` (Decimal), `tracked` (Boolean), `countryCodeOfOrigin`, `provinceCodeOfOrigin`, `harmonizedSystemCode`, `countryHarmonizedSystemCodes`
```graphql
mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
  inventoryItemUpdate(id: $id, input: $input) {
    inventoryItem { id unitCost { amount } tracked countryCodeOfOrigin harmonizedSystemCode }
    userErrors { message }
  }
}
```

**`inventoryAdjustQuantities`** (`write_inventory`) — Adjust by delta. Requires `@idempotent` in 2026-04.
- Input: `{ reason, name, referenceDocumentUri, changes: [{ delta, inventoryItemId, locationId }] }`
- Optional `changeFromQuantity` on each change for compare-and-swap.

**`inventoryMoveQuantities`** (`write_inventory`) — Move quantity between states at a single location (no cross-location moves).
- Input: `{ reason, referenceDocumentUri, changes: [{ quantity, inventoryItemId, from: { locationId, name, ledgerDocumentUri }, to: { locationId, name, ledgerDocumentUri } }] }`
- Returns `inventoryAdjustmentGroup { reason changes { name delta } }`

**`inventorySetQuantities`** (`write_inventory`) — Set absolute quantity for a named state. Supports compare-and-set.
- Input: `{ name, reason, referenceDocumentUri, ignoreCompareQuantity, quantities: [{ inventoryItemId, locationId, quantity, compareQuantity }] }`
- Use `compareQuantity` for optimistic concurrency; set `ignoreCompareQuantity: true` to skip the check.

**`inventorySetOnHandQuantities`** — **DEPRECATED**. Use `inventorySetQuantities` instead.

**`inventorySetScheduledChanges`** — **DEPRECATED**. Being phased out in 2026-07. Do not use.

### Shipment mutations (write_inventory_shipments)

| Mutation | What it does |
|---|---|
| `inventoryShipmentCreate(input: { movementId, lineItems })` | Create a DRAFT shipment on a transfer |
| `inventoryShipmentCreateInTransit(input: { movementId, lineItems })` | Create an IN_TRANSIT shipment on a transfer |
| `inventoryShipmentAddItems(id, lineItems: [{ inventoryItemId, quantity }])` | Add line items to a draft shipment |
| `inventoryShipmentRemoveItems(id, lineItems: [lineItemId])` | Remove line items from a draft shipment |
| `inventoryShipmentMarkInTransit(id, dateShipped)` | Transition a draft shipment to IN_TRANSIT |
| `inventoryShipmentReceive(id, lineItems: [{ shipmentLineItemId, quantity, reason }])` | Receive a shipment (reason: ACCEPTED \| REJECTED) |
| `inventoryShipmentDelete(id)` | Delete a draft shipment |

All shipment mutations require `@idempotent` in 2026-04. `movementId` is the `InventoryTransfer` GID.

### Transfer mutations (write_inventory_transfers)

**`inventoryTransferCreate`** — Create a DRAFT transfer between locations.
```graphql
mutation inventoryTransferCreate($input: InventoryTransferCreateInput!, $key: String!) {
  inventoryTransferCreate(input: $input) @idempotent(key: $key) {
    inventoryTransfer { id status }
    userErrors { field message }
  }
}
# input: { originLocationId, destinationLocationId, lineItems: [{ inventoryItemId, quantity }], note, referenceName, tags, dateCreated }
```
After creating, use `inventoryTransferMarkAsReadyToShip` to advance status.

### inventoryProperties query (read_inventory)
Returns shop's inventory configuration — all quantity names and their states.
```graphql
query inventoryProperties {
  inventoryProperties {
    quantityNames {
      name          # e.g. "available", "on_hand"
      displayName   # e.g. "Available", "On hand"
      isInUse       # whether the shop actively uses this state
      belongsTo     # parent states (e.g. available belongsTo ["on_hand"])
      comprises     # child states (e.g. on_hand comprises ["available","committed",...])
    }
  }
}
```
Use this to discover which quantity names are active before querying `quantities(names: [...])`.

### InventoryShipments (read_inventory_shipments)
Tracks physical shipments of inventory (incoming stock from suppliers or between locations).

**Query single shipment:**
```graphql
query {
  inventoryShipment(id: "gid://shopify/InventoryShipment/...") {
    id
    name
    status        # InventoryShipmentStatus enum
    barcode
    dateCreated
    dateShipped
    dateReceived
    totalAcceptedQuantity
    totalReceivedQuantity
    totalRejectedQuantity
    lineItemTotalQuantity
    tracking { ... }
    lineItems(first: 10) {
      edges { node { id } }
    }
  }
}
```

**List shipments (paginated):** `inventoryShipments(first, after, query, sortKey)`
- Filter by: `barcode:"12345"`, `status:"draft"`, `status:"in_transit"`, `destination_id:12345`, `tracking_number:"abc"`
- Sort by: `ID` (default)

### InventoryTransfers (read_inventory_transfers)
Tracks movement of inventory between locations. Includes origin/destination snapshots, line items, and shipments.

**Query single transfer:**
```graphql
query {
  inventoryTransfer(id: "gid://shopify/InventoryTransfer/...") {
    id
    name
    status        # InventoryTransferStatus enum
    note
    referenceName
    totalQuantity
    receivedQuantity
    dateCreated
    tags
    origin {      # LocationSnapshot — preserved even if location is deleted
      name
      location { id }
    }
    destination { name location { id } }
    lineItems(first: 10) {
      edges { node { id } }
    }
    shipments(first: 10) {
      edges { node { id name status } }
    }
  }
}
```
- Supports `metafield(namespace, key)` and `metafields(...)` for custom data.
- `origin`/`destination` are `LocationSnapshot` objects — historical address data persists even if the live location is later deleted.

## Locations (read_locations)

- `query ListLocations { locations(first: 20) { edges { node { id name address { city country } } } } }`