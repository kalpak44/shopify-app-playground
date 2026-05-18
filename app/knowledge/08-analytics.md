## Analytics & Reports (read_analytics / read_reports / write_reports)

- For sales totals, query orders with date filters and sum `totalPriceSet.shopMoney.amount` in your response.
- Saved reports: `query ListReports { reports(first: 20) { edges { node { id name category } } } }`
- Always call `get_current_datetime` to anchor "today" / "this week" / "last month" before building date filters.

## ShopifyQL Queries

Use `shopifyqlQuery` to run analytical queries against store data. Requires `read_reports` scope.

**Syntax:** `FROM <source> SHOW <metrics> [GROUP BY <dim>] [TIMESERIES <period>] [SINCE <time>] [ORDER BY <col>] [WITH TOTALS]`

Common sources: `sales`, `orders`, `customers`

```graphql
query {
  shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
    tableData {
      columns {
        name
        dataType
        displayName
      }
      rows
    }
    parseErrors
  }
}
```

**Response shape:**
- `tableData.columns` — array of `{ name, dataType, displayName, subType? }` — `subType` is set for array-typed columns (dataTypes: `MONEY`, `MONTH_TIMESTAMP`, etc.)
- `tableData.rows` — array of objects keyed by column name
- `parseErrors` — non-empty array of strings when the query has syntax errors; `tableData` will be `null`
- `WITH TOTALS` adds extra columns suffixed `__totals` with aggregate values

**Error handling:** always check `parseErrors` before reading `tableData`. If `parseErrors` is non-empty, report them to the user instead of trying to read rows.