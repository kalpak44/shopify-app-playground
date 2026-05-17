const ALLOWED_FILES = new Set(["templates/index.json"]);

const GET_THEMES_QUERY = `#graphql
  query GetThemes {
    themes(first: 20) {
      edges {
        node {
          id
          name
          role
        }
      }
    }
  }
`;

const UPSERT_THEME_FILE_MUTATION = `#graphql
  mutation ThemeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
    themeFilesUpsert(themeId: $themeId, files: $files) {
      upsertedThemeFiles {
        filename
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function getMainTheme(admin) {
  const response = await admin.graphql(GET_THEMES_QUERY);
  const { data, errors } = await response.json();

  if (errors?.length) {
    throw new Error(`Failed to fetch themes: ${errors[0].message}`);
  }

  const themes = (data?.themes?.edges ?? []).map((e) => e.node);
  const main = themes.find((t) => t.role === "MAIN");

  if (!main) {
    throw new Error("No main theme found on this store.");
  }

  return main;
}

export async function readThemeFile(admin, themeId, path) {
  // Build a dynamic query with the actual filename inline.
  const query = `#graphql
    query GetThemeFile($themeId: ID!) {
      theme(id: $themeId) {
        files(filenames: ${JSON.stringify([path])}) {
          edges {
            node {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
              }
            }
          }
          userErrors {
            code
            filename
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query, { variables: { themeId } });
  const { data, errors } = await response.json();

  if (errors?.length) {
    throw new Error(`Failed to read theme file: ${errors[0].message}`);
  }

  const filesResult = data?.theme?.files;
  if (filesResult?.userErrors?.length) {
    throw new Error(
      `Theme file error: ${filesResult.userErrors.map((e) => e.code).join(", ")}`
    );
  }

  const fileNode = filesResult?.edges?.[0]?.node;
  if (!fileNode) {
    return null;
  }

  return fileNode.body?.content ?? null;
}

export async function writeThemeFile(admin, themeId, path, content) {
  const response = await admin.graphql(UPSERT_THEME_FILE_MUTATION, {
    variables: {
      themeId,
      files: [{ filename: path, body: { type: "TEXT", value: content } }],
    },
  });

  const { data, errors } = await response.json();

  if (errors?.length) {
    throw new Error(`Failed to write theme file: ${errors[0].message}`);
  }

  const result = data?.themeFilesUpsert;
  if (result?.userErrors?.length) {
    throw new Error(
      result.userErrors.map((e) => e.message).join(", ")
    );
  }

  return result?.upsertedThemeFiles ?? [];
}