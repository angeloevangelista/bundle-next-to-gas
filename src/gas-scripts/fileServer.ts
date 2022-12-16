function doGet(
  requestEvent: GoogleAppsScript.Events.AppsScriptHttpRequestEvent
) {
  Logger.log(JSON.stringify(requestEvent, null, 2));

  if (requestEvent.pathInfo === "static") {
    return handleStaticRequest(requestEvent.parameter.filePath);
  }

  return HtmlService.createTemplateFromFile("index").evaluate();
}

function handleStaticRequest(
  filePath: string
): GoogleAppsScript.Content.TextOutput {
  const fileContent =
    HtmlService.createTemplateFromFile(filePath).getRawContent();

  return fileContent
    ? ContentService.createTextOutput(fileContent).setMimeType(
        ContentService.MimeType.JAVASCRIPT
      )
    : ContentService.createTextOutput("Not found").setMimeType(
        ContentService.MimeType.TEXT
      );
}

function include(filename: string) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
