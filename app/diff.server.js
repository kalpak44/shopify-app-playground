const CONTEXT = 3;

function lcsTable(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function diffLines(a, b) {
  const dp = lcsTable(a, b);
  const ops = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ op: "=", line: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ op: "+", line: b[j - 1] });
      j--;
    } else {
      ops.unshift({ op: "-", line: a[i - 1] });
      i--;
    }
  }

  return ops;
}

export function generateUnifiedDiff(before, after, filename = "file") {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const ops = diffLines(beforeLines, afterLines);

  const changePositions = ops
    .map((o, i) => (o.op !== "=" ? i : -1))
    .filter((i) => i >= 0);

  if (changePositions.length === 0) return "(no changes)";

  // Build contiguous hunk ranges from change positions + context
  const hunks = [];
  let hunkStart = changePositions[0] - CONTEXT;
  let hunkEnd = changePositions[0] + CONTEXT;

  for (let k = 1; k < changePositions.length; k++) {
    const cp = changePositions[k];
    if (cp - CONTEXT <= hunkEnd + 1) {
      hunkEnd = cp + CONTEXT;
    } else {
      hunks.push([Math.max(0, hunkStart), Math.min(ops.length - 1, hunkEnd)]);
      hunkStart = cp - CONTEXT;
      hunkEnd = cp + CONTEXT;
    }
  }
  hunks.push([Math.max(0, hunkStart), Math.min(ops.length - 1, hunkEnd)]);

  const output = [`--- a/${filename}`, `+++ b/${filename}`];

  for (const [start, end] of hunks) {
    // Calculate 1-based line numbers at the start of this hunk
    let beforeNum = 1;
    let afterNum = 1;
    for (let k = 0; k < start; k++) {
      if (ops[k].op !== "+") beforeNum++;
      if (ops[k].op !== "-") afterNum++;
    }

    let beforeCount = 0;
    let afterCount = 0;
    for (let k = start; k <= end; k++) {
      if (ops[k].op !== "+") beforeCount++;
      if (ops[k].op !== "-") afterCount++;
    }

    output.push(`@@ -${beforeNum},${beforeCount} +${afterNum},${afterCount} @@`);

    for (let k = start; k <= end; k++) {
      const o = ops[k];
      if (o.op === "=") output.push(` ${o.line}`);
      else if (o.op === "+") output.push(`+${o.line}`);
      else output.push(`-${o.line}`);
    }
  }

  return output.join("\n");
}