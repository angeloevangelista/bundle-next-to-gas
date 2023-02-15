function doGet(
  requestEvent: GoogleAppsScript.Events.AppsScriptHttpRequestEvent
) {
  Logger.log(`App url: ${ScriptApp.getService().getUrl()}`);
  Logger.log(`User email: ${Session.getEffectiveUser().getEmail()}`);

  Logger.log(JSON.stringify(requestEvent, null, 2));

  if (requestEvent.pathInfo === "static") {
    return handleStaticRequest(requestEvent.parameter.filePath);
  }

  if (requestEvent.pathInfo?.startsWith("api")) {
    return handleApiRequest(requestEvent.pathInfo.replace("api", ''));
  }

  const applicationEntryTemplate = HtmlService
    .createTemplateFromFile("index")
    .evaluate();

  applicationEntryTemplate.setTitle(PUBLIC_DATA.APPLICATION_NAME);

  return applicationEntryTemplate;
}
