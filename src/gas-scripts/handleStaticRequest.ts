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
