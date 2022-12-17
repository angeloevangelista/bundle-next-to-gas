import path from "path";
import jsdom from "jsdom";
import { NextConfig } from "next";

import {
  readFile,
  writeFile,
  createFolder,
  checkIfPathExists,
  deleteFolder,
  executeCommand,
  copyFolder,
  copyFile,
  renameFile,
  extractFilePaths,
} from "./utils";

async function generateGasBundle() {
  const tempFolderPath = path.resolve(__dirname, "..", "temp");

  const tempFolderExists = await checkIfPathExists(tempFolderPath);

  if (tempFolderExists) await deleteFolder(tempFolderPath);

  console.log("info: creating temp folder");
  await createFolder(tempFolderPath);

  const originalNextProjectPath = path.resolve(
    __dirname,
    "..",
    "..",
    "lar-go-whirlpool"
  );

  const nextProjectCopyPath = path.resolve(tempFolderPath, "next-project");

  console.log("info: copying next project to temp folder");
  await copyFolder(originalNextProjectPath, nextProjectCopyPath, {
    dereference: true,
    recursive: true,
  });

  console.log("info: removing previous builds and packages");
  await Promise.all(
    ["out", ".next", "node_modules"].map((folder) =>
      deleteFolder(path.resolve(nextProjectCopyPath, folder))
    )
  );

  console.log("info: creating routes.tsx component");
  const nextProjectCopyPagesPath = path.resolve(
    nextProjectCopyPath,
    "src",
    "pages"
  );

  const nextProjectPagesComponentsPaths = extractFilePaths(
    nextProjectCopyPagesPath
  ).filter((filePath) => filePath.endsWith(".tsx"));

  const pagesImportations: string[] = [];
  const pagesRouteDeclarations: string[] = [];

  nextProjectPagesComponentsPaths.forEach((nextProjectPagesComponentsPath) => {
    const partialPageComponentPath = nextProjectPagesComponentsPath.replace(
      nextProjectCopyPagesPath,
      ""
    );

    const countOfSeparators = partialPageComponentPath
      .split("")
      .filter((p) => p === path.sep).length;

    if (countOfSeparators === 1) return;

    const componentName =
      partialPageComponentPath
        .replace(".tsx", "")
        .split(path.sep)
        .map((p) => `${p.substring(0, 1).toUpperCase()}${p.substring(1)}`)
        .join("") + "Page";

    const componentImport = `const ${componentName} = require('.${partialPageComponentPath}').default;`;

    const componentRouteElement = `<Route path="${partialPageComponentPath.replace(
      /.tsx|\/index.tsx/gi,
      ""
    )}" element={<${componentName} />} />`;

    pagesImportations.push(componentImport);
    pagesRouteDeclarations.push(componentRouteElement);

    nextProjectPagesComponentsPath.replace(
      path.resolve(nextProjectCopyPath, "src"),
      ""
    );
  });

  const routesComponentContent = [
    `import { Route, Routes } from 'react-router-dom';`,
    ...pagesImportations,
    `const AppRoutes: React.FC = () => (`,
    `  <Routes>`,
    ...pagesRouteDeclarations,
    `  </Routes>`,
    `);`,
    `export default AppRoutes;`,
  ].join("\n");

  await writeFile(
    path.resolve(nextProjectCopyPagesPath, "routes.tsx"),
    routesComponentContent
  );

  console.log("info: updating _app.tsx to use routes.tsx");
  const nextProjectEntryComponentPath = path.resolve(
    nextProjectCopyPath,
    "src",
    "pages",
    "_app.tsx"
  );

  const nextProjectEntryComponentBuffer = await readFile(
    nextProjectEntryComponentPath
  );

  let nextProjectEntryComponentContent =
    nextProjectEntryComponentBuffer.toString();

  const nextProjectEntryComponentImportsUseEffect = /useEffect/gi.test(
    nextProjectEntryComponentContent
  );

  if (!nextProjectEntryComponentImportsUseEffect) {
    nextProjectEntryComponentContent = [
      `import { useEffect } from 'react'`,
      ...nextProjectEntryComponentContent.split("\n"),
    ].join("\n");
  }

  const nextProjectEntryComponentImportsUseState = /useState/gi.test(
    nextProjectEntryComponentContent
  );

  if (!nextProjectEntryComponentImportsUseState) {
    nextProjectEntryComponentContent = [
      `import { useState } from 'react'`,
      ...nextProjectEntryComponentContent.split("\n"),
    ].join("\n");
  }

  const nextProjectEntryComponentImportsAppProps = /AppProps/i.test(
    nextProjectEntryComponentContent
  );

  if (!nextProjectEntryComponentImportsAppProps) {
    nextProjectEntryComponentContent = [
      `import { AppProps } from 'next/app';`,
      ...nextProjectEntryComponentContent.split("\n"),
    ].join("\n");
  }

  nextProjectEntryComponentContent = [
    `import AppRoutes from './routes';`,
    `import { RouterProvider } from './useRouter';`,
    `import { HashRouter } from 'react-router-dom';`,
    ...nextProjectEntryComponentContent.split("\n"),
  ].join("\n");

  nextProjectEntryComponentContent = nextProjectEntryComponentContent
    .split("\n")
    .reduce<string[]>((acc, line) => {
      const itsComponentPropUsageLine =
        /(<Component {...pageProps} \/>|<Component \/>|<Component {...)/gi.test(
          line.trim()
        );

      if (itsComponentPropUsageLine) {
        acc.push("<AppRoutes />");
        line = `{/*${line}*/}`;
      }

      const itsExportLine = /export default.*/gi.test(line.trim());

      if (itsExportLine) {
        const componentName = line.replace(/;/gi, "").split(" ").pop();

        line = `/*${line}*/`;

        acc = [
          ...acc,
          ...[
            `export default ({ ...appProps }: AppProps) => {`,
            `  const [isInBrowser, setIsInBrowser] = useState(false);`,
            `  useEffect(() => setIsInBrowser(!!window), []);`,
            `  return (`,
            `    isInBrowser && (`,
            `      <HashRouter>`,
            `        <RouterProvider>`,
            `          <${componentName} {...appProps}></${componentName}>`,
            `        </RouterProvider>`,
            `      </HashRouter>`,
            `    )`,
            `  );`,
            `};`,
          ],
        ];
      }

      return [...acc, line];
    }, [])
    .join("\n");

  await writeFile(
    nextProjectEntryComponentPath,
    nextProjectEntryComponentContent
  );

  console.log("info: updating next project config");
  const nextConfigPath = path.resolve(nextProjectCopyPath, "next.config.js");

  const nextConfigBuffer = await readFile(nextConfigPath);

  let nextConfigContent = nextConfigBuffer.toString();

  const configLogCommand = "console.log(JSON.stringify(nextConfig));";

  const nextConfigHasLogOfItsValue =
    nextConfigContent.includes(configLogCommand);

  if (!nextConfigHasLogOfItsValue) {
    nextConfigContent += `\n${configLogCommand}`;
  }

  await writeFile(nextConfigPath, nextConfigContent);

  const nextConfigLogOutput = await executeCommand(
    "node next.config.js",
    nextProjectCopyPath
  );

  let tempNextConfigObject = JSON.parse(nextConfigLogOutput) as NextConfig;

  if (!tempNextConfigObject.images?.unoptimized) {
    tempNextConfigObject = {
      ...tempNextConfigObject,
      images: {
        ...tempNextConfigObject.images,
        unoptimized: true,
      },
    };
  }

  const newNextConfigContent = [
    `/** @type {import('next').NextConfig} */`,
    `const nextConfig = `,
    JSON.stringify(tempNextConfigObject, null, 2),
    `module.exports = nextConfig`,
  ].join("\n");

  await writeFile(nextConfigPath, newNextConfigContent);

  console.log("info: updating NextRouter usages to custom Router abstraction");
  const nextProjectCopySrcPath = path.resolve(nextProjectCopyPath, "src");

  const componentsThatUseNextRouterHookPathsPromises = extractFilePaths(
    nextProjectCopySrcPath
  ).map<
    Promise<{
      filePath: string;
      usesHook: boolean;
    }>
  >(async (filePath) => {
    if (!filePath.endsWith(".tsx"))
      return {
        filePath,
        usesHook: false,
      };

    const componentFileBuffer = await readFile(filePath);

    const componentUsesNextRouterHook = /useRouter()/gi.test(
      componentFileBuffer.toString()
    );

    return {
      filePath,
      usesHook: componentUsesNextRouterHook,
    };
  });

  const componentsThatUseNextRouterHookPromisesResult = await Promise.all(
    componentsThatUseNextRouterHookPathsPromises
  );

  const componentsThatUseNextRouterHookPaths =
    componentsThatUseNextRouterHookPromisesResult
      .filter(({ usesHook }) => usesHook)
      .map(({ filePath }) => filePath);

  const updateNextRouterUsageToNavigatePromises =
    componentsThatUseNextRouterHookPaths.map(async (componentFilePath) => {
      const componentFileBuffer = await readFile(componentFilePath);

      const partialComponentFilePath = componentFilePath.replace(
        path.resolve(nextProjectCopyPath, "src"),
        ""
      );

      let folderDepth = partialComponentFilePath.split("/").length - 2;
      let relativeUseRouterHookPath = "./";

      for (let i = 1; i <= folderDepth; i++) {
        relativeUseRouterHookPath += "../";
      }

      relativeUseRouterHookPath = path.join(
        relativeUseRouterHookPath,
        "pages",
        "useRouter.tsx"
      );

      let lines = componentFileBuffer.toString().split("\n");

      lines = lines.reduce<string[]>((acc, line) => {
        const isImportLine = /'next\/router'/gi.test(line);

        if (isImportLine) {
          acc.push(
            `import useRouter from '${relativeUseRouterHookPath.replace(
              ".tsx",
              ""
            )}';`
          );
          line = `/*${line}*/`;
        }

        return [...acc, line];
      }, []);

      await writeFile(componentFilePath, lines.join("\n"));
    });

  await Promise.all(updateNextRouterUsageToNavigatePromises);

  console.log("info: creating useRouter hook");

  const useRouterHookContent = [
    `import { useNavigate } from 'react-router-dom';`,
    `import { NextRouter, useRouter } from 'next/router';`,
    `import { createContext, useContext, useEffect, useState } from 'react';`,

    `const RouterContext = createContext<NextRouter>({} as NextRouter);`,

    `const RouterProvider: React.FC<{ children: JSX.Element }> = ({ children }) => {`,
    `	const [router, setRouter] = useState<NextRouter>();`,
    `	const nextRouter = useRouter();`,

    `	const navigate = useNavigate();`,
    `	const customRouter: NextRouter = {`,
    `		push(url, _, __) {`,
    `			return new Promise<boolean>((resolve, _) => {`,
    `				navigate(url.toString());`,
    `				resolve(true);`,
    `			});`,
    `		},`,
    `		back() {`,
    `			navigate(-1);`,
    `		},`,
    `	} as NextRouter;`,

    `	useEffect(() => {`,
    `		setRouter(`,
    `			Object.keys(nextRouter).reduce(`,
    `				(acc, routerKey) => ({`,
    `					...acc,`,
    `					[routerKey]:`,
    `						(customRouter as { [key: string]: any })[routerKey] ||`,
    `						(nextRouter as { [key: string]: any })[routerKey],`,
    `				}),`,
    `				{},`,
    `			) as NextRouter,`,
    `		);`,
    `	}, []);`,

    `	return router ? (`,
    `		<RouterContext.Provider value={{ ...router }}>`,
    `			{children}`,
    `		</RouterContext.Provider>`,
    `	) : (`,
    `		<></>`,
    `	);`,
    `};`,

    `export { RouterProvider };`,
    `export default () => useContext(RouterContext);`,
  ].join("\n");

  await writeFile(
    path.resolve(nextProjectCopyPagesPath, "useRouter.tsx"),
    useRouterHookContent
  );

  console.log("info: building project");
  await executeCommand(
    [
      "yarn add react-router-dom@^6.5.0",
      "yarn",
      "yarn next build",
      "yarn next export",
    ].join("&&"),
    nextProjectCopyPath
  );

  const staticBundlePath = path.resolve(nextProjectCopyPath, "out");

  await copyFile(
    path.resolve(__dirname, "..", "appsscript.json"),
    path.resolve(staticBundlePath, "appsscript.json")
  );

  await copyFile(
    path.resolve(__dirname, "gas-scripts", "fileServer.ts"),
    path.resolve(staticBundlePath, "fileServer.ts")
  );

  console.log("info: updating bundle script references");
  const bundleEntryPath = path.resolve(staticBundlePath, "index.html");

  const bundleEntryBuffer = await readFile(bundleEntryPath);

  let bundleEntryContent = bundleEntryBuffer.toString();

  var bundleEntryDOM = new jsdom.JSDOM(bundleEntryContent);

  const scriptElements = Array.from(
    bundleEntryDOM.window.document.querySelectorAll("script")
  ).filter((scriptElement) => scriptElement.src);

  const staticFilesPrefix = "<?= ScriptApp.getService().getUrl()?>/static";

  const updateProjectScriptsPromises = scriptElements.map(
    async (scriptElement) => {
      const physicalScriptFilePath = path.join(
        staticBundlePath,
        scriptElement.src
      );

      await renameFile(
        physicalScriptFilePath,
        path.join(staticBundlePath, scriptElement.src.replace(".js", ".html"))
      );

      scriptElement.src = `${staticFilesPrefix}?filePath=${scriptElement.src
        .replace(".js", "")
        .substring(1)}`;
    }
  );

  await Promise.all(updateProjectScriptsPromises);

  console.log("info: updating bundle style references");
  const stylesheetLinkElements = Array.from(
    bundleEntryDOM.window.document.querySelectorAll("link")
  )
    .filter(
      (stylesheetLinkElement) => stylesheetLinkElement.rel === "stylesheet"
    )
    .reduce<HTMLLinkElement[]>(
      (acc, stylesheetLinkElement) =>
        acc.some((p) => p.href === stylesheetLinkElement.href)
          ? acc
          : [...acc, stylesheetLinkElement],
      []
    );

  const updateProjectStylesheetsPromises = stylesheetLinkElements.map<
    Promise<string>
  >(async (stylesheetLinkElement) => {
    const physicalStylesFilePath = path.join(
      staticBundlePath,
      stylesheetLinkElement.href
    );

    const styleElementBuffer = await readFile(physicalStylesFilePath);

    stylesheetLinkElement.remove();

    await writeFile(
      physicalStylesFilePath,
      `<style>${styleElementBuffer.toString()}</style>`
    );

    await renameFile(
      physicalStylesFilePath,
      path.join(
        staticBundlePath,
        stylesheetLinkElement.href.replace(".css", ".html")
      )
    );

    return `<?!= include('${stylesheetLinkElement.href
      .replace(".css", "")
      .substring(1)}'); ?>`;
  });

  const stylesheetIncludes = await Promise.all(
    updateProjectStylesheetsPromises
  );

  bundleEntryContent =
    bundleEntryDOM.window.document.body.parentElement!.outerHTML;

  const startOfEndOfBodyIndex = bundleEntryContent
    .toUpperCase()
    .indexOf("</BODY>");

  bundleEntryContent = [
    bundleEntryContent.substring(0, startOfEndOfBodyIndex),
    stylesheetIncludes.join(""),
    bundleEntryContent.substring(startOfEndOfBodyIndex),
  ].join("");

  console.log("info: updating bundle entrypoint");
  await writeFile(bundleEntryPath, bundleEntryContent);
}

generateGasBundle();
