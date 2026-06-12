// RiseForce Snippets - Google Apps Script Web App
// Deploy: Extensions > Apps Script > Deploy > New Deployment > Web App
// Execute as: Me | Who has access: Anyone in [Your Org] or Anyone

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('✨ RiseForce Snippets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserData() {
  try {
    var p = PropertiesService.getUserProperties();
    return {
      rf_favs:              p.getProperty('rf_favs'),
      rf_customs:           p.getProperty('rf_customs'),
      rf_pins:              p.getProperty('rf_pins'),
      rf_overrides:         p.getProperty('rf_overrides'),
      rf_counts:            p.getProperty('rf_counts'),
      rf_recent:            p.getProperty('rf_recent'),
      rf_para_order:        p.getProperty('rf_para_order'),
      rf_nav_order:         p.getProperty('rf_nav_order'),
      riseforce_agent_name: p.getProperty('riseforce_agent_name'),
      riseforce_theme:      p.getProperty('riseforce_theme'),
      riseforce_color:      p.getProperty('riseforce_color'),
      riseforce_scratch:    p.getProperty('riseforce_scratch'),
      rf_seen_version:      p.getProperty('rf_seen_version')
    };
  } catch(e) { return {}; }
}

function setUserData(data) {
  try {
    var p = PropertiesService.getUserProperties();
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      if (data[keys[i]] != null) p.setProperty(keys[i], String(data[keys[i]]));
    }
    return true;
  } catch(e) { return false; }
}
