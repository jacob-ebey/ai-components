import * as path from "node:path";

import { OpenAI } from "openai";
import { LocalIndex } from "vectra";

const workdir = path.resolve("model/chadcn-ui");

const openai = new OpenAI();
const index = new LocalIndex(path.join(workdir, "db"));

const icons = await index.queryItems(
  (
    await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input:
        `SimpleButton`,
    })
  ).data[0].embedding,
  10
);

for (const icon of icons) {
  console.log({
    score: icon.score,
    metadata: icon.item.metadata,
  });
}
