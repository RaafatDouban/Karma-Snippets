// RiseForce Snippets - Google Apps Script Web App
// Deploy: Extensions > Apps Script > Deploy > New Deployment > Web App
// Execute as: Me | Who has access: Anyone in [Your Org] or Anyone

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('✨ RiseForce Snippets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
