import { spawnSync } from "node:child_process";

const acceptedAdvisory =
  "https://github.com/advisories/GHSA-qwww-vcr4-c8h2";
const acceptedPackages = new Set(["react-router", "react-router-dom"]);
const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const npmExecutable = process.env.npm_execpath ? process.execPath : "npm";
const npmArguments = process.env.npm_execpath
  ? [process.env.npm_execpath, "audit", "--omit=dev", "--json"]
  : ["audit", "--omit=dev", "--json"];
const result = spawnSync(npmExecutable, npmArguments, {
  encoding: "utf8",
  shell: false,
});

if (!result.stdout) {
  console.error(
    result.error?.message ||
      result.stderr ||
      "npm audit did not return a report.",
  );
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("Unable to parse the npm audit report.");
  process.exit(1);
}

const vulnerabilities = Object.entries(report.vulnerabilities ?? {});
const unexpectedAdvisories = vulnerabilities.flatMap(([, vulnerability]) =>
  (vulnerability.via ?? [])
    .filter((item) => typeof item === "object" && item.url)
    .filter((item) => item.url !== acceptedAdvisory),
);
const unexpectedPackages = vulnerabilities.filter(
  ([name, vulnerability]) =>
    (severityRank[vulnerability.severity] ?? 0) >= severityRank.moderate &&
    !acceptedPackages.has(name),
);

if (unexpectedAdvisories.length > 0 || unexpectedPackages.length > 0) {
  console.error("Unexpected production dependency vulnerabilities detected:");
  unexpectedPackages.forEach(([name, vulnerability]) =>
    console.error(`- ${name}: ${vulnerability.severity}`),
  );
  unexpectedAdvisories.forEach((advisory) =>
    console.error(`- ${advisory.url}: ${advisory.title}`),
  );
  process.exit(1);
}

if (vulnerabilities.length > 0) {
  console.warn(
    "Accepted exception: GHSA-qwww-vcr4-c8h2 only affects unstable React Router RSC APIs, which Fiscora does not use.",
  );
}

console.log("Production dependency audit passed.");
