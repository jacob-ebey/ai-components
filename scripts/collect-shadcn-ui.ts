import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import * as esbuild from "esbuild";
import * as lexer from "es-module-lexer";
import fm from "front-matter";

const workdir = path.resolve("model/chadcn-ui");

await fs.mkdir(workdir, { recursive: true });

const schemaResponse = await fetch(
  "https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/registry/schema.ts"
);
await fs.writeFile(
  path.join(workdir, "schema.ts"),
  await schemaResponse.text()
);

const registryResponse = await fetch(
  "https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/registry/registry.ts"
);
const [_, ...registryLines] = (await registryResponse.text()).split("\n");
let registrySource = registryLines.join("\n");
registrySource = registrySource.replace(
  /const ui: Registry/,
  "export const ui: Registry"
);
registrySource = registrySource.replace(
  /const example: Registry/,
  "export const example: Registry"
);
registrySource = `import { Registry } from "./schema.js";\n${registrySource}`;
await fs.writeFile(path.join(workdir, "registry.ts"), registrySource);

const { ui, example: examples } = await import(
  "../model/chadcn-ui/registry.js"
);

const examplesMetadata: {
  mappings: Record<string, string[]>;
  sources: Record<string, string>;
} = {
  mappings: {},
  sources: {},
};
let i = 0;
for (const example of examples) {
  console.log(`collecting example ${++i}/${ui.length}: ${example.name}`);
  if (!example.files?.length || !example.registryDependencies?.length) continue;

  const exampleResponse = await fetch(
    `https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/registry/default/${example.files[0]}`
  );
  if (!exampleResponse.ok) continue;
  let exampleSource = await exampleResponse.text();
  exampleSource = exampleSource.replace(
    /\@\/registry\/default\//g,
    "~/components/"
  );
  examplesMetadata.sources[example.name] = exampleSource;

  for (const dep of example.registryDependencies) {
    examplesMetadata.mappings[dep] ||= [];
    examplesMetadata.mappings[dep].push(example.name);
  }
}

const componentsMetadata: Record<
  string,
  { description: string; import: string; importStatement: string }
> = {};

i = 0;
for (const component of ui) {
  console.log(`collecting component ${++i}/${ui.length}: ${component.name}`);
  const [docsResponse, sourceResponse] = await Promise.all([
    fetch(
      `https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/content/docs/components/${component.name}.mdx`
    ),
    fetch(
      `https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/registry/default/${component.files[0]}`
    ),
  ]);
  if (!docsResponse.ok || !sourceResponse.ok) continue;
  const docsMdx = await docsResponse.text();
  const { attributes: docAttributes } = fm<{ description: string }>(docsMdx);

  const source = await sourceResponse.text();

  const transformed = await esbuild.transform(source, {
    target: "esnext",
    platform: "neutral",
    minify: false,
    jsx: "automatic",
    treeShaking: false,
    loader: "tsx",
  });
  const [, theExports] = lexer.parse(transformed.code);
  const canImport = theExports
    .map((e) => transformed.code.slice(e.s, e.e))
    .join(", ");
  const importStatement = `import { ${canImport} } from "~/components/${component.files[0]}";`;

  componentsMetadata[component.name] = {
    description: docAttributes.description,
    import: `~/components/ui/${component.name}`,
    importStatement,
  };
}

await fs.writeFile(
  path.join(workdir, "metadata.json"),
  JSON.stringify(
    { components: componentsMetadata, examples: examplesMetadata },
    null,
    2
  )
);
