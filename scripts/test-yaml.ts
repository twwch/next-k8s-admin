import yaml from 'yaml';

// Simulate the exact data from the user's request
const variablesYaml = `APP_NAME:
    description: "应用名称"
    default: "nginx-deploy"
  NAMESPACE:
    description: "命名空间"
    default: "default"
  IMAGE:
    description: "容器镜像"
    default: "nginx:1.24"
  REPLICAS:
    description: "副本数"
    default: "2"`;

function dedent(str: string): string {
  const lines = str.split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) return str;
  const min = Math.min(...nonEmpty.map(l => (l.match(/^(\s*)/) as any)[1].length));
  return min === 0 ? str : lines.map(l => l.slice(min)).join('\n');
}

console.log("=== Original ===");
variablesYaml.split('\n').forEach((l, i) => console.log(`${i}: [${l}]`));

console.log("\n=== Dedented ===");
const cleaned = dedent(variablesYaml);
cleaned.split('\n').forEach((l, i) => console.log(`${i}: [${l}]`));

console.log("\n=== Parse attempt ===");
try {
  console.log(JSON.stringify(yaml.parse(cleaned), null, 2));
} catch(e: any) {
  console.log("ERROR:", e.message);
}
