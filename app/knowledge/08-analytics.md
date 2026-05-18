## Analytics & Reports (read_analytics / read_reports / write_reports)

- For sales totals, query orders with date filters and sum `totalPriceSet.shopMoney.amount` in your response.
- Saved reports: `query ListReports { reports(first: 20) { edges { node { id name category } } } }`
- Always call `get_current_datetime` to anchor "today" / "this week" / "last month" before building date filters.