function doGet() {
  return HtmlService.createHtmlOutputFromFile('sara-snippets')
    .setTitle('✨ Sara Snippets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserData() {
  try {
    var p = PropertiesService.getUserProperties();
    return {
      favs:            p.getProperty('favs'),
      customs:         p.getProperty('customs'),
      custom_sections: p.getProperty('custom_sections'),
      sect_order:      p.getProperty('sect_order'),
      snip_order:      p.getProperty('snip_order'),
      chat_agent_name: p.getProperty('chat_agent_name'),
      chat_theme:      p.getProperty('chat_theme'),
      chat_color:      p.getProperty('chat_color'),
      recent:          p.getProperty('recent')
    };
  } catch(e) { return {}; }
}

function setUserData(data) {
  try {
    var p = PropertiesService.getUserProperties();
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      if (data[keys[i]] != null) p.setProperty(keys[i], data[keys[i]]);
    }
    return true;
  } catch(e) { return false; }
}
