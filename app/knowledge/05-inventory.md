## Inventory (read_inventory / write_inventory)

- Get inventory for a variant: query `productVariant(id) { inventoryItem { id } }` first to get the `inventoryItemId`.
- List inventory levels: `inventoryItem(id) { inventoryLevels(first: 10) { edges { node { location { id name } quantities(names: ["available", "on_hand"]) { name quantity } } } } }`
- Adjust quantity (delta, not absolute): `mutation AdjustInventory { inventoryAdjustQuantities(input: { reason: "correction", name: "available", changes: [{ delta: 10, inventoryItemId: "gid://shopify/InventoryItem/...", locationId: "gid://shopify/Location/..." }] }) { inventoryAdjustmentGroup { reason changes { name delta } } userErrors { field message } } }`
- Set absolute quantity: use `inventorySetQuantities` with `quantities: [{ inventoryItemId, locationId, quantity, name: "available" }]`

## Locations (read_locations)

- `query ListLocations { locations(first: 20) { edges { node { id name address { city country } } } } }`