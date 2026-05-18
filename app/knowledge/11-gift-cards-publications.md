## Gift Cards (read_gift_cards / write_gift_cards)

- List: `query ListGiftCards { giftCards(first: 20) { edges { node { id balance { amount currencyCode } maskedCode expiresOn customer { email } } } } }`
- Create: `mutation CreateGiftCard { giftCardCreate(input: { initialValue: "50.00", currency: "USD", customerId }) { giftCard { id maskedCode } userErrors { field message } } }`

## Publications / Sales Channels (read_publications / write_publications)

- List sales channels: `query ListPublications { publications(first: 10) { edges { node { id name } } } }`
- Publish a product to a channel: `mutation Publish { publishablePublish(id: "gid://shopify/Product/...", input: { publicationId: "gid://shopify/Publication/..." }) { publishable { ... on Product { id } } userErrors { field message } } }`
- Unpublish: `publishableUnpublish(id, input: { publicationId })`