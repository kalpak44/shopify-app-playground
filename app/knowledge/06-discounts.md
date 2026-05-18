## Discounts (read_discounts / write_discounts)

- List automatic discounts: `query ListDiscounts { automaticDiscountNodes(first: 20) { edges { node { id automaticDiscount { ... on DiscountAutomaticBasic { title status startsAt endsAt } } } } } }`
- List code discounts: `discountNodes(first: 20) { edges { node { id discount { ... on DiscountCodeBasic { title status codes(first:3) { edges { node { code } } } } } } } }`
- Create automatic % discount: `mutation CreateDiscount { discountAutomaticBasicCreate(automaticBasicDiscount: { title, startsAt, customerGets: { value: { percentage: 0.15 }, items: { all: true } } }) { automaticDiscountNode { id } userErrors { field message } } }`
- Create code discount: use `discountCodeBasicCreate` with `code`, `customerGets`, and optionally `minimumRequirement`.

## Price Rules (read_price_rules / write_price_rules)

- Legacy API but still active. Use `priceRules(first: 20)` to list. Prefer the Discounts API for new discounts.