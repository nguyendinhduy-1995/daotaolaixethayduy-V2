import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "src", "app", "api");
const MAP_FILE = path.join(ROOT, "src", "lib", "route-permissions-map.ts");

const ENFORCE_HELPERS = [
  "requireMappedRoutePermissionAuth",
  "requirePermissionRouteAuth",
];

type RouteMethod = { method: string; path: string; file: string; content: string };
type Rule = { method?: string; pattern: RegExp };
type MapRule = { method: string; pattern: RegExp };

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name === "route.ts") out.push(full);
  }
  return out;
}

function toApiPath(filePath: string) {
  const rel = path.relative(path.join(ROOT, "src", "app"), filePath).replace(/\\/g, "/");
  return `/${rel.replace(/\/route\.ts$/, "")}`;
}

function concretePath(apiPath: string) {
  return apiPath.replace(/\[[^/\]]+\]/g, "x");
}

function parseMethods(fileContent: string) {
  const methods = new Set<string>();
  const regex = /^export async function (GET|POST|PATCH|PUT|DELETE)\b/gm;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(fileContent)) !== null) {
    methods.add(match[1]);
  }
  return [...methods];
}

function parseRulesFromSection(content: string, sectionName: string): Rule[] {
  const marker = `export const ${sectionName}`;
  const start = content.indexOf(marker);
  if (start === -1) return [];
  const arrayStart = content.indexOf("[", start);
  const arrayEnd = content.indexOf("];", arrayStart);
  if (arrayStart === -1 || arrayEnd === -1) return [];
  const body = content.slice(arrayStart + 1, arrayEnd);

  const rules: Rule[] = [];
  const itemRegex = /\{\s*(?:method:\s*"([A-Z]+)",\s*)?pattern:\s*(\/\^[^\n]+?\/)\s*\}/g;
  let match: RegExpExecArray | null = null;
  while ((match = itemRegex.exec(body)) !== null) {
    const method = match[1] || undefined;
    const patternLiteral = match[2];
    const raw = patternLiteral.slice(1, -1);
    rules.push({ method, pattern: new RegExp(raw) });
  }
  return rules;
}

function parseMapRules(content: string): MapRule[] {
  const rules: MapRule[] = [];
  const regex = /\{\s*method:\s*"([A-Z]+)",\s*pattern:\s*(\/\^[^\n]+?\/),\s*module:/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1];
    const patternLiteral = match[2];
    const raw = patternLiteral.slice(1, -1);
    rules.push({ method, pattern: new RegExp(raw) });
  }
  return rules;
}

function isAllowlisted(pathname: string, method: string, rules: Rule[]) {
  const methodUpper = method.toUpperCase();
  return rules.some((rule) => {
    if (rule.method && rule.method !== methodUpper) return false;
    return rule.pattern.test(pathname);
  });
}

function extractMethodBlock(fileContent: string, method: string) {
  const escaped = method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startPattern = new RegExp(`export\\s+async\\s+function\\s+${escaped}\\s*\\(`, "m");
  const startMatch = startPattern.exec(fileContent);
  if (!startMatch || startMatch.index === undefined) return "";

  const afterStart = fileContent.slice(startMatch.index);
  const nextExportIdx = afterStart.slice(1).search(/\nexport\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/m);
  if (nextExportIdx === -1) return afterStart;
  return afterStart.slice(0, nextExportIdx + 1);
}

function hasEnforceHelper(methodBlock: string) {
  return ENFORCE_HELPERS.some((helper) => methodBlock.includes(`${helper}(`));
}

function main() {
  const mapContent = fs.readFileSync(MAP_FILE, "utf8");
  const publicRules = parseRulesFromSection(mapContent, "PUBLIC_API_ROUTES");
  const secretRules = parseRulesFromSection(mapContent, "SECRET_AUTH_ROUTES");
  const mappedRules = parseMapRules(mapContent);

  const routeFiles = walk(API_ROOT);
  const routeMethods: RouteMethod[] = [];

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, "utf8");
    const methods = parseMethods(content);
    const apiPath = toApiPath(file);
    for (const method of methods) {
      routeMethods.push({ method, path: apiPath, file: path.relative(ROOT, file), content });
    }
  }

  const uncovered: RouteMethod[] = [];
  const mappedButNotEnforced: RouteMethod[] = [];

  for (const route of routeMethods) {
    const concrete = concretePath(route.path);
    const allowlisted = isAllowlisted(concrete, route.method, publicRules) || isAllowlisted(concrete, route.method, secretRules);
    const mapped = mappedRules.some((rule) => rule.method === route.method && rule.pattern.test(concrete));

    if (!allowlisted && !mapped) {
      uncovered.push(route);
      continue;
    }

    if (mapped) {
      const methodBlock = extractMethodBlock(route.content, route.method);
      if (!hasEnforceHelper(methodBlock)) {
        mappedButNotEnforced.push(route);
      }
    }
  }

  console.log(`Total route methods: ${routeMethods.length}`);
  console.log(`Mapped rules: ${mappedRules.length}`);
  console.log(`Allowlist public: ${publicRules.length}`);
  console.log(`Allowlist secret: ${secretRules.length}`);

  if (uncovered.length > 0) {
    console.error("\n[FAIL] Route methods chưa có permission map hoặc allowlist:");
    for (const item of uncovered) {
      console.error(`- ${item.method} ${item.path} (${item.file})`);
    }
  }

  if (mappedButNotEnforced.length > 0) {
    console.error("\n[FAIL] Route methods đã map nhưng chưa gọi helper enforce:");
    for (const item of mappedButNotEnforced) {
      console.error(`- ${item.method} ${item.path} (${item.file})`);
    }
    console.error(`\nHelper hợp lệ: ${ENFORCE_HELPERS.join(", ")}`);
  }

  if (uncovered.length > 0 || mappedButNotEnforced.length > 0) {
    process.exit(1);
  }

  console.log("\n[PASS] Coverage mapping + enforce helper đều hợp lệ.");
}

main();
