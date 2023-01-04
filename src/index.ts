import path from "path";
import jsdom from "jsdom";
import { NextConfig } from "next";
import mimeTypes from "mime-types";
import loading from "loading-cli";

import {
  readFile,
  writeFile,
  createFolder,
  checkIfPathExists,
  deleteFolder,
  executeCommand,
  copyFolder,
  copyFile,
  extractFilePaths,
  listFiles,
} from "./utils";

async function generateGasBundle() {
  const nextProjectRelativePath = "next-project";

  const load = loading({
    frames: ["⠇", "⠏", "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"],
  });

  load.start().text = "info: removing temp folder if exists";

  const tempFolderPath = path.resolve(__dirname, "..", "temp");

  const tempFolderExists = await checkIfPathExists(tempFolderPath);

  if (tempFolderExists) await deleteFolder(tempFolderPath);

  load.succeed().start().text = "info: creating temp folder";
  await createFolder(tempFolderPath);

  const originalNextProjectPath = path.resolve(
    __dirname,
    "..",
    "..",
    nextProjectRelativePath
  );

  const nextProjectCopyPath = path.resolve(tempFolderPath, "next-project");

  load.succeed().start().text = "info: copying next project to temp folder";
  await copyFolder(originalNextProjectPath, nextProjectCopyPath, {
    dereference: true,
    recursive: true,
  });

  load.succeed().start().text = "info: removing previous builds and packages";
  await Promise.all(
    ["out", ".next", "node_modules"].map((folder) =>
      deleteFolder(path.resolve(nextProjectCopyPath, folder))
    )
  );

  load.succeed().start().text = "info: creating routes.tsx component";
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
        .join("")
        .replace(/(\[|])/g, '') + "Page";

    const componentImport = `const ${componentName} = require('.${partialPageComponentPath}').default;`;

    const componentRouteElement = `<Route path="${partialPageComponentPath.replace(
      /.tsx|\/index.tsx/gi,
      ""
    ).replace(/\[/g, ':').replace(/]/g, '')}" element={<${componentName} />} />`;

    pagesImportations.push(componentImport);
    pagesRouteDeclarations.push(componentRouteElement);

    nextProjectPagesComponentsPath.replace(
      path.resolve(nextProjectCopyPath, "src"),
      ""
    );
  });

  const indexPageExists = await checkIfPathExists(
    path.resolve(nextProjectCopyPagesPath, "index.tsx")
  );

  if (indexPageExists) {
    pagesImportations.push(`const IndexPage = require('./index.tsx').default;`);

    pagesRouteDeclarations.push(`<Route path="/" element={<IndexPage />} />`);
  }

  const notFoundPageExists = await checkIfPathExists(
    path.resolve(nextProjectCopyPagesPath, "404.tsx")
  );

  if (notFoundPageExists) {
    pagesImportations.push(
      `const NotFoundPage = require('./404.tsx').default;`
    );

    pagesRouteDeclarations.push(
      `<Route path="*" element={<NotFoundPage />} />`
    );
  }

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

  load.succeed().start().text = "info: updating _app.tsx to use routes.tsx";
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
      `import { useEffect } from 'react';`,
      ...nextProjectEntryComponentContent.split("\n"),
    ].join("\n");
  }

  const nextProjectEntryComponentImportsUseState = /useState/gi.test(
    nextProjectEntryComponentContent
  );

  if (!nextProjectEntryComponentImportsUseState) {
    nextProjectEntryComponentContent = [
      `import { useState } from 'react';`,
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
        const startIndexOfComponentUsage = line.indexOf("<Component");
        const endIndexOfComponentUsage = line.indexOf("/>") + 2;

        line = [
          line.substring(0, startIndexOfComponentUsage),
          "<AppRoutes />",
          line.substring(endIndexOfComponentUsage),
        ].join("");
      }

      const itsExportLine = /export default.*/gi.test(line.trim());

      if (itsExportLine) {
        const itsDeclarationDefaultExport = /(export default function)/.test(
          line
        );

        if (itsDeclarationDefaultExport) {
          line = line.replace("export default", "");
        }

        const componentName = itsDeclarationDefaultExport
          ? line
            .trim()
            .split(" ")
            .at(1)
            ?.replace(/(\({|\()/gi, "")
          : line.replace(/;/gi, "").split(" ").pop();

        if (!itsDeclarationDefaultExport) {
          line = `/*${line}*/`;
        }

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

  load.succeed().start().text = "info: updating next.config.js";
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

  tempNextConfigObject = {
    ...tempNextConfigObject,
    eslint: {
      ...tempNextConfigObject.eslint,
      ignoreDuringBuilds: true,
    },
  };

  const newNextConfigContent = [
    `/** @type {import('next').NextConfig} */`,
    `const nextConfig = `,
    JSON.stringify(tempNextConfigObject, null, 2),
    `module.exports = nextConfig`,
  ].join("\n");

  await writeFile(nextConfigPath, newNextConfigContent);

  load.succeed().start().text =
    "info: updating NextRouter usages to custom Router abstraction";
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

  load.succeed().start().text = "info: creating useRouter hook";

  const useRouterHookContent = [
    `import { useNavigate, useParams } from 'react-router-dom';`,
    `import { NextRouter, useRouter } from 'next/router';`,
    `import { createContext, useContext, useEffect, useState } from 'react';`,

    `const RouterContext = createContext<NextRouter>({} as NextRouter);`,

    `const RouterProvider: React.FC<{ children: JSX.Element }> = ({ children }) => {`,
    `	 const [router, setRouter] = useState<NextRouter>();`,
    `	 const nextRouter = useRouter();`,

    `	 const params = useParams();`,
    `	 const navigate = useNavigate();`,
    `	 const customRouter: NextRouter = {`,
    `    query: {`,
    `	     ...params,`,
    `    },`,
    `	 	 push(url, _, __) {`,
    `      return new Promise<boolean>((resolve, _) => {`,
    `	 	 		 navigate(url.toString());`,
    `	 	 		 resolve(true);`,
    `	 	   });`,
    `	 	 },`,
    `	 	 back() {`,
    `      navigate(-1);`,
    `	 	 },`,
    `  } as NextRouter;`,

    `useEffect(() => {`,
    `	setRouter(`,
    `		Object.keys(nextRouter).reduce(`,
    `			(acc, routerKey) => ({`,
    `				...acc,`,
    `				[routerKey]:`,
    `					(customRouter as { [key: string]: any })[routerKey] ||`,
    `					(nextRouter as { [key: string]: any })[routerKey],`,
    `			}),`,
    `			{},`,
    `		) as NextRouter,`,
    `	);`,
    `}, []);`,

    `  return router ? (`,
    `    <RouterContext.Provider value={{ ...router }}>`,
    `      {children}`,
    `    </RouterContext.Provider>`,
    `  ) : (`,
    `  	<></>`,
    `  );`,
    `};`,

    `export { RouterProvider };`,
    `export default () => useContext(RouterContext);`,
  ].join("\n");

  await writeFile(
    path.resolve(nextProjectCopyPagesPath, "useRouter.tsx"),
    useRouterHookContent
  );

  load.succeed().start().text = "info: building project";
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

  load.succeed().start().text = "info: converting assets to base64 data";
  const assetsPath = path.resolve(staticBundlePath, "assets");

  const assetsFilesPaths = extractFilePaths(assetsPath);

  const convertAssetsToBase64Promises = assetsFilesPaths.map(
    async (filePath) => {
      const fileBuffer = await readFile(filePath);

      const fileMimetype = mimeTypes.lookup(filePath);

      const fileBase64Reference = `data:${fileMimetype};base64, ${fileBuffer.toString(
        "base64"
      )}`;

      await writeFile(
        filePath.replace(path.extname(filePath), ".txt"),
        fileBase64Reference
      );
    }
  );

  await Promise.all(convertAssetsToBase64Promises);

  load.succeed().start().text =
    "info: updating assets references to use base64";
  const assetsReferencePattern = new RegExp("/assets/", "gi");

  const bundledFilesThatUseAssetsPathsPromises = extractFilePaths(
    staticBundlePath
  ).map<Promise<{ filePath: string; usesAssets: boolean }>>(
    async (filePath) => {
      const fileBuffer = await readFile(filePath);
      const fileContent = fileBuffer.toString();

      const usesAssets = assetsReferencePattern.test(fileContent);

      return {
        filePath,
        usesAssets,
      };
    }
  );

  const bundledFilesThatUseAssetsResult = await Promise.all(
    bundledFilesThatUseAssetsPathsPromises
  );

  const bundledFilesThatUseAssetsPaths = bundledFilesThatUseAssetsResult
    .filter(({ usesAssets }) => usesAssets)
    .map(({ filePath }) => filePath);

  const updateAssetsReferencesToBase64Promises =
    bundledFilesThatUseAssetsPaths.map(async (filePath) => {
      const fileBuffer = await readFile(filePath);
      let fileContent = fileBuffer.toString();

      const assetsReferences = Array.from(
        fileContent.matchAll(assetsReferencePattern)
      ).map((p) => {
        const slicedContent = p.input?.substring(p.index!);

        const endIndexOfOccurrence = slicedContent?.indexOf('"');

        return slicedContent?.substring(0, endIndexOfOccurrence);
      });

      const replaceForBase64Promises = assetsReferences
        .filter((p) => !!p?.trim())
        .map((p) => String(p))
        .map(async (assetReference) => {
          const encodedAssetPath = path.resolve(
            assetsPath,
            assetReference
              .replace(assetsReferencePattern, "")
              .replace(path.extname(assetReference), ".txt")
          );

          const encodedAssetBuffer = await readFile(encodedAssetPath);

          fileContent = fileContent.replace(
            assetReference,
            encodedAssetBuffer.toString()
          );
        });

      await Promise.all(replaceForBase64Promises);

      await writeFile(filePath, fileContent);
    });

  await Promise.all(updateAssetsReferencesToBase64Promises);

  load.succeed().start().text = "info: getting entrypoint DOM";
  const bundleEntryPath = path.resolve(staticBundlePath, "index.html");

  const bundleEntryBuffer = await readFile(bundleEntryPath);

  let bundleEntryContent = bundleEntryBuffer.toString();

  var bundleEntryDOM = new jsdom.JSDOM(bundleEntryContent);

  load.succeed().start().text = "info: updating bundle script references";
  const scriptElements = Array.from(
    bundleEntryDOM.window.document.querySelectorAll("script")
  ).filter((scriptElement) => scriptElement.src);

  const updateScriptsReferencesToContentScriptTagsPromises = scriptElements.map(
    async (scriptElement) => {
      const physicalScriptFilePath = path.join(
        staticBundlePath,
        scriptElement.src
      );

      const scriptBuffer = await readFile(physicalScriptFilePath);

      const scriptMimetype = mimeTypes.lookup(physicalScriptFilePath);

      const fileBase64Reference = `data:${scriptMimetype};base64, ${scriptBuffer.toString(
        "base64"
      )}`;

      scriptElement.type = String(scriptMimetype);
      scriptElement.src = fileBase64Reference;
    }
  );

  await Promise.all(updateScriptsReferencesToContentScriptTagsPromises);

  load.succeed().start().text = "info: updating bundle style/links references";
  const linkElements = Array.from(
    bundleEntryDOM.window.document.querySelectorAll("link")
  ).filter((linkElement) => linkElement.rel === "stylesheet");

  const updateLinksReferencesToBase64Promises = linkElements.map(
    async (linkElement) => {
      const physicalLinkFilePath = path.join(
        staticBundlePath,
        linkElement.href
      );

      const linkPointsToPhysicalFile = await checkIfPathExists(
        physicalLinkFilePath
      );

      if (!linkPointsToPhysicalFile) return;

      const linkBuffer = await readFile(physicalLinkFilePath);

      const linkMimetype = mimeTypes.lookup(physicalLinkFilePath);

      const fileBase64Reference = `data:${linkMimetype};base64, ${linkBuffer.toString(
        "base64"
      )}`;

      linkElement.type = String(linkMimetype);
      linkElement.href = fileBase64Reference;
    }
  );

  await Promise.all(updateLinksReferencesToBase64Promises);

  load.succeed().start().text = "info: setting application URL on localStorage";
  const setGasDataScriptElement = bundleEntryDOM.window.document.createElement(
    "script",
  );

  setGasDataScriptElement.innerHTML = `
    const appUrl = <?= ScriptApp.getService().getUrl()?>;
    const userEmail = <?= Session.getEffectiveUser().getEmail()?>;

    window.GAS_DATA = {
      APP_URL: appUrl,
      USER_EMAIL: userEmail,
    }
  `;

  bundleEntryDOM.window.document.body.appendChild(setGasDataScriptElement)

  load.succeed().start().text =
    "info: updating entrypoint DOM with updated scripts/styles";
  bundleEntryContent =
    bundleEntryDOM.window.document.body.parentElement!.outerHTML;

  load.succeed().start().text = "info: updating bundle entrypoint";
  await writeFile(bundleEntryPath, bundleEntryContent);

  load.succeed().start().text = "info: copying gas files to output folder";
  const gasFilesDestinationPath = path.resolve(tempFolderPath, "gas");
  const gasFilesToCopyPath = path.resolve(__dirname, "gas-scripts");

  await createFolder(gasFilesDestinationPath);

  const gasScriptsToCopyPaths = await listFiles(gasFilesToCopyPath);
  const nextOutFirstLevelFilesPaths = await listFiles(staticBundlePath);

  let copyFilesPromises: Promise<void>[] = []

  copyFilesPromises.push(
    copyFile(
      path.resolve(__dirname, "..", "appsscript.json"),
      path.resolve(gasFilesDestinationPath, "appsscript.json")
    ),
    ...nextOutFirstLevelFilesPaths
      .map(async (fileName) => {
        await copyFile(
          path.resolve(staticBundlePath, fileName),
          path.resolve(gasFilesDestinationPath, fileName)
        );
      }),
    ...gasScriptsToCopyPaths
      .map(async (fileName) => {
        await copyFile(
          path.resolve(gasFilesToCopyPath, fileName),
          path.resolve(gasFilesDestinationPath, fileName)
        );
      }),
  )

  await Promise.all(copyFilesPromises);

  load.succeed();
}

generateGasBundle();

//if it doesn't work, You can set a variable with user email on first get