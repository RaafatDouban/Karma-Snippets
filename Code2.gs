function doGet() {
  return HtmlService.createHtmlOutputFromFile('douban-snippets')
    .setTitle('✨ Douban Snippets')
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
      overrides:       p.getProperty('overrides'),
      pins:            p.getProperty('pins'),
      chat_agent_name: p.getProperty('chat_agent_name'),
      chat_theme:      p.getProperty('chat_theme'),
      chat_color:      p.getProperty('chat_color'),
      recent:          p.getProperty('recent'),
      scratchpad:      p.getProperty('scratchpad'),
      seen_version:    p.getProperty('seen_version')
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

function callGemini_(prompt) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return { error: 'no_key' };
  var response = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
    {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      muteHttpExceptions: true
    }
  );
  var result = JSON.parse(response.getContentText());
  if (result.error) return { error: result.error.message };
  var text = result.candidates && result.candidates[0] &&
    result.candidates[0].content && result.candidates[0].content.parts &&
    result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text;
  if (!text) return { error: 'Empty response from AI' };
  return { text: text };
}

function getAISuggestions(message, sectionsJson) {
  try {
    var sections = JSON.parse(sectionsJson);
    var libraryText = sections.map(function(s) {
      var snips = s.snippets.map(function(item) {
        return '    [' + item.i + '] ' + item.t;
      }).join('\n');
      return '## ' + s.label + ' (id: ' + s.id + ')\n' + snips;
    }).join('\n\n');

    var prompt = 'You are a Lyft customer support assistant. An agent needs help picking the right pre-written snippets to respond to a customer.\n\n' +
      'Customer message:\n"""\n' + message + '\n"""\n\n' +
      'Available snippets:\n' + libraryText + '\n\n' +
      'Pick 5-6 most relevant snippets and return them in the ORDER the agent should SEND them (greeting first if needed, then empathy, then hold while checking, then explanation, then closure last). Each snippet is a SEPARATE chat message — think sequence, not one block.\n\n' +
      'Respond ONLY with a JSON array — no other text:\n' +
      '[{"sectionId":"...","snippetIndex":0,"reason":"why this fits in one short phrase"}]';

    var res = callGemini_(prompt);
    if (res.error) return { error: res.error };

    var match = res.text.match(/\[[\s\S]*\]/);
    if (!match) return { error: 'Could not parse AI response' };
    return { suggestions: JSON.parse(match[0]) };
  } catch(e) {
    return { error: e.toString() };
  }
}

function improveSnippet(text, instruction) {
  try {
    var prompt = 'You are a customer support writing assistant for Lyft.\n\n' +
      'Original snippet:\n"""\n' + text + '\n"""\n\n' +
      'Instruction: ' + instruction + '\n\n' +
      'Return ONLY the improved snippet text. No quotes, no explanation, no intro. Preserve any [placeholder] markers exactly as they appear. Keep the professional support tone.';

    var res = callGemini_(prompt);
    if (res.error) return { error: res.error };
    return { text: res.text.trim() };
  } catch(e) {
    return { error: e.toString() };
  }
}
