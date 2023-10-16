import * as path from "node:path";

import { OpenAI } from "openai";
import { LocalIndex } from "vectra";

import metadata from "../model/chadcn-ui/metadata.json" assert { type: "json" };

export {};

const workdir = path.resolve("model/chadcn-ui");

const openai = new OpenAI();
const index = new LocalIndex(path.join(workdir, "db"));
if (!(await index.isIndexCreated())) {
  await index.createIndex();
}

let i = 0;
const components = Object.entries(metadata.components);
for (const [name, info] of components) {
  console.log(`embedding component ${++i}/${components.length}: ${name}`);
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: name,
  });

  for (const embedding of response.data) {
    await index.insertItem({
      vector: embedding.embedding,
      metadata: { name },
    });
  }
}
