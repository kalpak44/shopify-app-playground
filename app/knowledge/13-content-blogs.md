## Blogs & Online Store Content (read_content / read_online_store_pages)

### Count blogs

Capped at 10000 by default; pass `limit: null` to remove the cap. `precision` is `EXACT` or `AT_LEAST`.

```graphql
query {
  blogsCount { count precision }
}
```

Filter by: `title`, `handle`, `id`, `created_at`, `updated_at`.