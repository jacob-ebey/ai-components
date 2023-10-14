import { useEffect, useState } from "react";
import { ZipReader, TextWriter } from "@zip.js/zip.js";

import { WebContainer, type WebContainerProcess } from "@webcontainer/api";

declare global {
  interface Window {
    devServerPromise: Promise<{
      port: number;
      url: string;
      setCode(code: string): void;
    }>;
  }
}

function logProcessOutput(process: WebContainerProcess) {
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        console.log(data);
      },
    })
  );
}

export function initDevServer() {
  if (!window.devServerPromise) {
    console.log("booting web container...");
    window.devServerPromise = WebContainer.boot({
      coep: "none",
    }).then(async (webContainer) => {
      console.log("initializing vite app...");
      const zipResponse = await fetch("/vite-template-main.zip");
      const reader = new ZipReader(zipResponse.body!);
      const entries = await reader.getEntries();
      for (const entry of entries) {
        const fullPath = entry.filename.slice("vite-template-main/".length);
        if (entry.directory && fullPath) {
          await webContainer.fs.mkdir(fullPath, { recursive: true });
        }
        if (entry.directory || !entry.getData) continue;
        const contents = await entry.getData(new TextWriter());
        await webContainer.fs.writeFile(fullPath, contents);
      }

      console.log("initialized vite app");

      console.log("installing dependencies...");
      let process = await webContainer.spawn("npm", ["install"]);
      logProcessOutput(process);
      console.log("done installing dependencies", await process.exit);
      if ((await process.exit) !== 0) {
        throw new Error("failed to install dependencies");
      }

      await webContainer.spawn("npm", ["run", "dev"]);
      const devServer = await new Promise<{
        port: number;
        url: string;
        setCode(code: string): void;
      }>((resolve) => {
        webContainer.on("server-ready", (port, url) => {
          console.log(`server ready at ${url}`);
          resolve({
            port,
            url,
            setCode(code: string) {
              webContainer.fs.writeFile("src/App.tsx", code);
            },
          });
        });
      });

      return devServer;
    });
    window
      .devServerPromise!.then(() => {
        console.log("web container ready");
      })
      .catch(console.error);
  }
}

export function ComponentPreview({ code }: { code: string }) {
  const [devServer, setDevServer] =
    useState<Awaited<typeof window.devServerPromise>>();
  useEffect(() => {
    let aborted = false;
    initDevServer();

    (async () => {
      const devServer = await window.devServerPromise!;
      if (aborted) {
        return;
      }
      setDevServer(devServer);
    })().catch((error) => {
      console.error(error);
    });

    return () => {
      aborted = true;
    };
  }, []);

  useEffect(() => {
    if (devServer) {
      devServer.setCode(code);
    }
  }, [devServer, code]);

  return devServer ? (
    <iframe
      className="w-full h-[calc(100vh-(16px*2))] min-h-[50vh] border"
      title="Component Preview"
      src={devServer.url}
    />
  ) : (
    <div className="h-[calc(100vh-(16px*2))] min-h-[50vh] border p-4">
      <p>Loading Component Preview...</p>
    </div>
  );
}
