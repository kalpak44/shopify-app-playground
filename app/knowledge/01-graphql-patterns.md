## Shopify GraphQL Admin API — General Patterns (API version 2026-04)

- All IDs are Global IDs: `gid://shopify/Product/123`, `gid://shopify/Order/456`, etc.
- Connections use Relay pagination: `edges { node { ... } } pageInfo { hasNextPage endCursor }`
- Filter strings use the `query:` argument: `query: "created_at:>2024-01-01 financial_status:paid"`
- ISO 8601 dates: `created_at:>2024-06-01T00:00:00Z`
- Always request `userErrors { field message }` in every mutation response.