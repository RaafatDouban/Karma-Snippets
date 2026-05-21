function doGet() {
  return HtmlService.createHtmlOutputFromFile('sara-snippets')
    .setTitle('✨ Sara Snippets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
