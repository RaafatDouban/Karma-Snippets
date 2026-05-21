function doGet() {
  return HtmlService.createHtmlOutputFromFile('douban-snippets')
    .setTitle('✨ Douban Snippets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
