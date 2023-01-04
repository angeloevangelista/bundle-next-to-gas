function handleApiRequest(route: string): GoogleAppsScript.Content.TextOutput {
  let response = {
    route,
    message: 'Hello, World',
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
