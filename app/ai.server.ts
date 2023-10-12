import { multipassFactory } from "openai-multipass";

export const designComponentFactory = multipassFactory({ debug: true })
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
                      enum: [],
                    },
                  },
                },
                required: ["does_new_component_need_icons_elements"],
              },
            },
            required: [
              "new_component_name",
              "new_component_description",
              "new_component_icons_elements",
            ],
          },
        },
      ],
      messages: [
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
            "Multiple library components can be used while creating a new component in order to help you do a better design job, faster.",
        },
        {
          role: `user`,
          content:
            "USER QUERY : \n```\n" +
            input +
            "\n```\n\n" +
            `Design the new React web component task for the user as the creative genius you are`,
        },
      ],
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
    };

    return {
      prompt: input,
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
    };
  })
  .pass("build-component-context", ({ input }) => {
    return {
      ...input,
      componentContext: [],
    };
  })
  .pass("generate-new-component", async ({ input, complete }) => {
    const completion = await complete({
      model: "gpt-4",
      messages: [
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
        ...input.componentContext,
        {
          role: `user`,
          content:
            `- COMPONENT NAME : ${input.name}\n\n` +
            `- COMPONENT DESCRIPTION :\n` +
            "```\n" +
            input +
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
      ],
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
