import * as fs from "node:fs/promises";
import { type MultipassFactory, multipassFactory } from "openai-multipass";
import tiktoken from "@dqbd/tiktoken";

const tiktokenEncoder = tiktoken.get_encoding("cl100k_base");

const exampleTokenLimit = 100;

function logPromptTokens(
  label: string,
  messages: {
    role: "function" | "system" | "user" | "assistant";
    content: string;
  }[]
): {
  role: "function" | "system" | "user" | "assistant";
  content: string;
}[] {
  let tokens = 0;
  for (const message of messages) {
    tokens += tiktokenEncoder.encode(message.content).length;
  }
  console.log(JSON.stringify(messages, null, 2));
  console.log(`${label} prompt tokens : ${tokens}`);

  return messages;
}

async function buildLibraryContext({
  input,
}: {
  input:
    | string
    | { prompt: string; code: string; name: string; description: string };
}) {
  const componentsMetadata = JSON.parse(
    await fs.readFile("model/component-lib/dump.json", "utf8")
  ) as {
    name: string;
    description: string;
    docs: {
      import: {
        source: string;
        code: string;
      };
      use: {
        source: string;
        code: string;
      }[];
      examples: {
        source: string;
        code: string;
      }[];
    };
  }[];
  const iconsMetadata = JSON.parse(
    await fs.readFile("model/icons/dump.json", "utf8")
  ) as {
    source: string;
    name: string;
    title: string;
    tags: string[];
    categories: string[];
  }[];

  return {
    componentsMetadata,
    iconsMetadata,
    prompt: typeof input === "string" ? input : input.prompt,
    inputCode: typeof input === "object" ? input.code : null,
    inputName: typeof input === "object" ? input.name : null,
    inputDescription: typeof input === "object" ? input.description : null,
  };
}

function buildComponentContext({
  input,
}: {
  input: {
    inputCode: string | null;
    inputName: string | null;
    inputDescription: string | null;
    prompt: string;
    name: string;
    description: string;
    icons: string[] | null;
    components: string[] | null;
    componentsMetadata: {
      name: string;
      description: string;
      docs: {
        import: {
          source: string;
          code: string;
        };
        use: {
          source: string;
          code: string;
        }[];
        examples: {
          source: string;
          code: string;
        }[];
      };
    }[];
    iconsMetadata: {
      source: string;
      name: string;
      title: string;
      tags: string[];
      categories: string[];
    }[];
  };
}) {
  const allComponents =
    input.components && typeof input.components === "string"
      ? [input.components]
      : input.components ?? [];
  console.log({ components: allComponents });
  const neededComponents = new Set(allComponents.map((c) => c.toLowerCase()));
  const components = input.componentsMetadata.filter((c) =>
    neededComponents.has(c.name.toLowerCase())
  );

  const componentsContext: {
    role: "user";
    content: string;
  }[] = [];
  let i = -1;
  for (const component of components) {
    i++;
    let consumedTokens = 0;

    const examples: (typeof component)["docs"]["examples"][0][] = [];
    for (const example of component.docs.examples) {
      consumedTokens += tiktokenEncoder.encode(example.code).length;
      if (consumedTokens > exampleTokenLimit) {
        break;
      }
      examples.push(example);
    }

    const examples_block = !examples.length
      ? ""
      : "\n\n" +
        `# full code examples of React components that use ${component.name} :\n` +
        examples
          .map((example) => {
            return (
              "```" + example.source + "\n" + example.code.trim() + "\n```"
            );
          })
          .join(`\n\n`);

    componentsContext.push({
      role: `user`,
      content:
        `Library components can be used while making the new React component\n\n` +
        `Suggested library component (${i + 1}/${components.length}) : ${
          component.name
        } - ${component.description}\n\n\n` +
        `# ${component.name} can be imported into the new component like this:\n` +
        "```tsx\n" +
        component.docs.import.code.trim() +
        "\n```\n\n---\n\n" +
        `# examples of how ${component.name} can be used inside the new component:\n` +
        component.docs.use
          .map((block) => {
            return "```tsx\n" + block.code.trim() + "\n```";
          })
          .join(`\n\n`) +
        "\n\n---" +
        examples_block,
    });
  }

  return {
    ...input,
    componentsContext,
  };
}

export const designComponentFactory = multipassFactory({ debug: true })
  .pass("build-library-context", buildLibraryContext)
  .pass("design-component-from-description", async ({ input, complete }) => {
    const completion = await complete({
      model: "gpt-3.5-turbo",
      functions: [
        {
          name: `design_new_component_api`,
          description: `generate the required design details to create a new component`,
          parameters: {
            type: "object",
            properties: {
              new_component_name: {
                type: "string",
                description: "the name of the new component",
              },
              new_component_description: {
                type: "string",
                description: `Write a description for the React component design task based on the user query. Stick strictly to what the user wants in their request - do not go off track`,
              },
              new_component_icons_elements: {
                type: "object",
                description:
                  "the icons and elements to use in the new component",
                properties: {
                  does_new_component_need_icons_elements: {
                    type: "boolean",
                    description:
                      "does the new component need icons and elements",
                  },
                  if_so_what_new_component_icons_elements_are_needed: {
                    type: "array",
                    items: {
                      type: "string",
                      description: "the name of the icon element needed",
                    },
                  },
                },
                required: ["does_new_component_need_icons_elements"],
              },
              use_library_components: {
                type: "array",
                description: "the name of the library components to use",
                items: {
                  type: "string",
                  enum: input.componentsMetadata.map((e) => e.name),
                },
              },
            },
            required: [
              "new_component_name",
              "new_component_description",
              "new_component_icons_elements",
              "use_library_components",
            ],
          },
        },
      ],
      messages: logPromptTokens("design", [
        {
          role: `system`,
          content:
            `Your task is to design a new React component for a web app, according to the user's request.\n` +
            `If you judge it is relevant to do so, you can specify pre-made library components to use in the task.\n` +
            `You can also specify the use of icons if you see that the user's request requires it.`,
        },
        {
          role: `user`,
          content:
            "Multiple library components can be used while creating a new component in order to help you do a better design job, faster.\n\nAVAILABLE LIBRARY COMPONENTS:\n```\n" +
            input.componentsMetadata
              .map((e) => {
                return `${e.name} : ${e.description};`;
              })
              .join("\n") +
            "\n```",
        },
        {
          role: `user`,
          content:
            "USER QUERY : \n```\n" +
            input.prompt +
            "\n```\n\n" +
            `Design the new React web component task for the user as the creative genius you are`,
        },
      ]),
    });

    if (!completion.functionCall) {
      throw new Error("no function call");
    }
    const functionCall = completion.functionCall as {
      new_component_name: string;
      new_component_description: string;
      new_component_icons_elements: {
        does_new_component_need_icons_elements: boolean;
        if_so_what_new_component_icons_elements_are_needed?: string[];
      };
      use_library_components: string[];
    };

    return {
      inputCode: input.inputCode,
      inputDescription: input.inputDescription,
      inputName: input.inputName,
      prompt: input.prompt,
      name: functionCall.new_component_name,
      description: functionCall.new_component_description,
      icons:
        functionCall.new_component_icons_elements
          .does_new_component_need_icons_elements &&
        (functionCall.new_component_icons_elements
          .if_so_what_new_component_icons_elements_are_needed?.length ?? 0) > 0
          ? functionCall.new_component_icons_elements
              .if_so_what_new_component_icons_elements_are_needed!
          : null,
      components:
        (functionCall.use_library_components?.length ?? 0) > 0
          ? functionCall.use_library_components
          : null,
      componentsMetadata: input.componentsMetadata,
      iconsMetadata: input.iconsMetadata,
    };
  })
  .pass("build-component-context", buildComponentContext)
  .pass("generate-new-component", async ({ input, complete }) => {
    const completion = await complete({
      model: "gpt-4",
      messages: logPromptTokens("generate", [
        {
          role: `system`,
          content:
            `You are an expert at writing React components.\n` +
            `Your task is to write a new React component for a web app, according to the provided task details.\n` +
            `The React component you write can make use of Tailwind classes for styling.\n` +
            `If you judge it is relevant to do so, you can use library components and icons.\n\n` +
            `You will write the full React component code, which should include all imports.` +
            `Your generated code will be directly written to a .tsx React component file and used in production.`,
        },
        ...input.componentsContext,
        {
          role: `user`,
          content:
            `- COMPONENT NAME : ${input.name}\n\n` +
            `- COMPONENT DESCRIPTION :\n` +
            "```\n" +
            input.prompt +
            "\n```\n\n" +
            `- additional component suggestions :\n` +
            "```\n" +
            input.description +
            "\n```\n\n\n" +
            `Write the full code for the new React web component, which uses Tailwind classes if needed (add tailwind dark: classes too if you can; backgrounds in dark: classes should be black), and optionally, library components and icons, based on the provided design task.\n` +
            "The full code of the new React component that you write will be written directly to a .tsx file inside the React project. Make sure all necessary imports are done, and that your full code is enclosed with ```tsx blocks.\n" +
            "Answer with generated code only. DO NOT ADD ANY EXTRA TEXT DESCRIPTION OR COMMENTS BESIDES THE CODE. Your answer contains code only ! component code only !\n" +
            `Important :\n` +
            `- Make sure you import provided components libraries and icons that are provided to you if you use them !\n` +
            `- All inputs should be uncontrolled and *not* rely on local state !\n` +
            `- All inputs should have a name attribute !\n` +
            `- Tailwind classes should be written directly in the elements class tags (or className in case of React). DO NOT WRITE ANY CSS OUTSIDE OF CLASSES. DO NOT USE ANY <style> IN THE CODE ! CLASSES STYLING ONLY !\n` +
            `- Do not use libraries or imports except what is provided in this task; otherwise it would crash the component because not installed. Do not import extra libraries besides what is provided above !\n` +
            `- DO NOT HAVE ANY DYNAMIC DATA OR DATA PROPS ! Components are meant to be working as is without supplying any variable to them when importing them ! Only write a component that render directly with placeholders as data, component not supplied with any dynamic data.\n` +
            `- DO NOT HAVE ANY DYNAMIC DATA OR DATA PROPS ! ` +
            `- Only write the code for the component; Do not write extra code to import it! The code will directly be stored in an individual React .tsx file !\n` +
            `$- Very important : Your component should be exported as default !\n` +
            `Write the React component code as the creative genius and React component genius you are - with good ui formatting.\n`,
        },
      ]),
    });

    if (!completion.content) {
      throw new Error("could not generate new component");
    }

    let code = ``;
    let start = false;
    for (let l of completion.content.split("\n")) {
      let skip = false;
      if (["```", "```tsx"].includes(l.toLowerCase().trim())) {
        start = !start;
        skip = true;
      }
      if (start && !skip) code += `${l}\n`;
    }
    code = code.trim();

    return {
      name: input.name,
      description: input.description,
      prompt: input.prompt,
      code,
    };
  });

export const iterateComponentFactory = (
  multipassFactory({ debug: true }) as unknown as MultipassFactory<{
    prompt: string;
    name: string;
    description: string;
    code: string;
  }>
)
  .pass("build-library-context", buildLibraryContext)
  .pass(
    "design-component-iteration-from-description",
    async ({ input, complete }) => {
      const completion = await complete({
        model: "gpt-3.5-turbo",
        functions: [
          {
            name: `design_new_component_api`,
            description: `generate the required design details to updated the provided component`,
            parameters: {
              type: "object",
              properties: {
                new_component_name: {
                  type: "string",
                  description: "the name of the new component",
                },
                new_component_description: {
                  type: "string",
                  description: `Write a description for the React component design task based on the user query. Stick strictly to what the user wants in their request - do not go off track`,
                },
                new_component_icons_elements: {
                  type: "object",
                  description:
                    "the icons and elements to use in the new component",
                  properties: {
                    does_new_component_need_icons_elements: {
                      type: "boolean",
                      description:
                        "does the new component need icons and elements",
                    },
                    if_so_what_new_component_icons_elements_are_needed: {
                      type: "array",
                      items: {
                        type: "string",
                        description: "the name of the icon element needed",
                      },
                    },
                  },
                  required: ["does_new_component_need_icons_elements"],
                },
                use_library_components: {
                  type: "array",
                  description: "the name of the library components to use",
                  items: {
                    type: "string",
                    enum: input.componentsMetadata.map((e) => e.name),
                  },
                },
              },
              required: [
                "new_component_name",
                "new_component_description",
                "new_component_icons_elements",
                "use_library_components",
              ],
            },
          },
        ],
        messages: logPromptTokens("design", [
          {
            role: `system`,
            content:
              `Your task is to modify a React component for a web app, according to the user's request.\n` +
              `If you judge it is relevant to do so, you can specify pre-made library components to use in the task.\n` +
              `You can also specify the use of icons if you see that the user's request requires it.`,
          },
          {
            role: `user`,
            content:
              "Multiple library components can be used while creating a new component in order to help you do a better design job, faster.\n\nAVAILABLE LIBRARY COMPONENTS:\n```\n" +
              input.componentsMetadata
                .map((e) => {
                  return `${e.name} : ${e.description};`;
                })
                .join("\n") +
              "\n```",
          },
          {
            role: `user`,
            content:
              `- Component name : ${input.inputName}\n` +
              "- Component description : `" +
              input.inputDescription +
              "`\n" +
              "- New component updates query : \n```\n" +
              input.prompt +
              "\n```\n\n" +
              `Design the React web component updates for the user, as the creative genius you are`,
          },
        ]),
      });

      if (!completion.functionCall) {
        throw new Error("no function call");
      }
      const functionCall = completion.functionCall as {
        new_component_name: string;
        new_component_description: string;
        new_component_icons_elements: {
          does_new_component_need_icons_elements: boolean;
          if_so_what_new_component_icons_elements_are_needed?: string[];
        };
        use_library_components: string[];
      };

      return {
        inputCode: input.inputCode,
        inputDescription: input.inputDescription,
        inputName: input.inputName,
        prompt: input.prompt,
        name: functionCall.new_component_name,
        description: functionCall.new_component_description,
        icons:
          functionCall.new_component_icons_elements
            .does_new_component_need_icons_elements &&
          (functionCall.new_component_icons_elements
            .if_so_what_new_component_icons_elements_are_needed?.length ?? 0) >
            0
            ? functionCall.new_component_icons_elements
                .if_so_what_new_component_icons_elements_are_needed!
            : null,
        components:
          (functionCall.use_library_components?.length ?? 0) > 0
            ? functionCall.use_library_components
            : null,
        componentsMetadata: input.componentsMetadata,
        iconsMetadata: input.iconsMetadata,
      };
    }
  )
  .pass("build-component-context", buildComponentContext)
  .pass("generate-new-component", async ({ input, complete }) => {
    const completion = await complete({
      model: "gpt-4",
      messages: logPromptTokens("generate", [
        {
          role: `system`,
          content:
            `You are an expert at writing React components.\n` +
            `Your task is to write a new update for the provided React component for a web app, according to the provided task details.\n` +
            `The React component you write can make use of Tailwind classes for styling.\n` +
            `If you judge it is relevant to do so, you can use library components and icons.\n\n` +
            `You will write the full React component code, which should include all imports.` +
            `Your generated code will be directly written to a .tsx React component file and used in production.`,
        },
        ...input.componentsContext,
        {
          role: `user`,
          content:
            `- COMPONENT NAME : ${input.name}\n\n` +
            `- COMPONENT DESCRIPTION :\n` +
            "```\n" +
            input.description +
            "\n```\n\n" +
            `- CURRENT COMPONENT CODE :\n\n` +
            "```tsx\n" +
            input.inputCode +
            "\n```\n\n" +
            `- DESIRED COMPONENT UPDATES :\n\n` +
            "```\n" +
            input.prompt +
            "\n```\n\n" +
            `- additional component update suggestions :\n` +
            "```\n" +
            input.description +
            "\n```\n\n\n" +
            `Write the full code for the new, updated React web component, which uses Tailwind classes if needed (add tailwind dark: classes too if you can; backgrounds in dark: classes should be black), and optionally, library components and icons, based on the provided design task.\n` +
            "The full code of the new React component that you write will be written directly to a .tsx file inside the React project. Make sure all necessary imports are done, and that your full code is enclosed with ```tsx blocks.\n" +
            "Answer with generated code only. DO NOT ADD ANY EXTRA TEXT DESCRIPTION OR COMMENTS BESIDES THE CODE. Your answer contains code only ! component code only !\n" +
            `Important :\n` +
            `- Make sure you import provided components libraries and icons that are provided to you if you use them !\n` +
            `- Tailwind classes should be written directly in the elements class tags (or className in case of React). DO NOT WRITE ANY CSS OUTSIDE OF CLASSES\n` +
            `- Do not use libraries or imports except what is provided in this task; otherwise it would crash the component because not installed. Do not import extra libraries besides what is provided above !\n` +
            `- Do not have ANY dynamic data! Components are meant to be working as is without supplying any variable to them when importing them ! Only write a component that render directly with placeholders as data, component not supplied with any dynamic data.\n` +
            `- Only write the code for the component; Do not write extra code to import it! The code will directly be stored in an individual React .tsx file !\n` +
            "- Very important : Your component should be exported as default !\n" +
            `Write the updated version of the React component code as the creative genius and React component genius you are - with good ui formatting.\n`,
        },
      ]),
    });

    if (!completion.content) {
      throw new Error("could not generate new component");
    }

    let code = ``;
    let start = false;
    for (let l of completion.content.split("\n")) {
      let skip = false;
      if (["```", "```tsx"].includes(l.toLowerCase().trim())) {
        start = !start;
        skip = true;
      }
      if (start && !skip) code += `${l}\n`;
    }
    code = code.trim();

    return {
      name: input.name,
      description: input.description,
      prompt: input.prompt,
      code,
    };
  });
