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
    return handleApiRequest(requestEvent.pathInfo.replace("api", ''))
  }

  return HtmlService.createTemplateFromFile("index").evaluate();
}

export { doGet }