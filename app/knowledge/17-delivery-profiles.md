## Delivery Profiles (shipping / manage_delivery_settings)

A `DeliveryProfile` groups products with shipping zones and rates. Each profile has one or more `DeliveryProfileLocationGroup` objects, each linking a set of locations to zones (`DeliveryZone`) with method definitions (`DeliveryMethodDefinition`) and rates.

Requires `shipping` access scope or `manage_delivery_settings` user permission.

### Create a delivery profile

```graphql
mutation createDeliveryProfile($profile: DeliveryProfileInput!) {
  deliveryProfileCreate(profile: $profile) {
    profile {
      id
      name
      profileLocationGroups {
        locationGroup {
          id
          locations(first: 5) { nodes { name address { country } } }
        }
        locationGroupZones(first: 10) {
          edges {
            node {
              zone {
                id
                name
                countries { code { countryCode } provinces { code } }
              }
            }
          }
        }
      }
    }
    userErrors { field message }
  }
}
```

**`DeliveryProfileInput` shape:**
- `name` — profile name
- `locationGroupsToCreate` — array of `DeliveryProfileLocationGroupInput`:
  - `locationsToAdd` — location GIDs to include in this group
  - `zonesToCreate` — array of zones, each with:
    - `name` — zone name
    - `countries` — `{ code: "CA", provinces: [{ code: "ON" }] }` (array or single object)
    - `methodDefinitionsToCreate` — array of shipping methods:
      - `name` — method name shown to customers
      - `rateDefinition: { price: { amount, currencyCode } }` — flat rate
      - `weightConditionsToCreate` — optional weight gates: `[{ operator: GREATER_THAN_OR_EQUAL_TO, criteria: { value, unit: KILOGRAMS } }]`

⚠️ Start with no more than 5 location groups per mutation due to input complexity; add more groups later via `deliveryProfileUpdate`.

### Update a delivery profile

```graphql
mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
  deliveryProfileUpdate(id: $id, profile: $profile) {
    profile { id name }
    userErrors { field message }
  }
}
```

The `DeliveryProfileInput` for updates uses the same fields as create, plus targeted patch fields:
- `locationGroupsToCreate` — add new location groups (same shape as create)
- `locationGroupsToUpdate` — modify existing groups; requires `id: "gid://shopify/DeliveryLocationGroup/..."` plus:
  - `locationsToAdd` / `locationsToRemove` — add/remove location GIDs from the group
  - `zonesToCreate` / `zonesToUpdate` / `zonesToDelete` — manage zones within the group
- `locationGroupsToDelete` — remove entire location groups by GID

⚠️ Update no more than 5 groups per request.