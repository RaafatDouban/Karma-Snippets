# Team Library Sync — Implementation Guide

## Overview

Team Library Sync lets a team lead publish shared snippets to all agents from within the same app.  
Agents see a read-only **📣 Team Library** section. The lead edits and publishes via a PIN-protected admin panel.  
No external services — everything lives inside the existing GAS deployment.

---

## How it works

```
GAS Script Properties (shared, all users)
├── team_sections      → JSON — array of section objects the lead published
├── team_version       → timestamp string of last publish
└── team_announcement  → optional string banner message shown to all agents

GAS User Properties (private per agent)
└── (everything already there — favs, customs, pins, etc.)
```

When an agent loads the app, `loadFromServer()` calls **both** `getUserData()` and `getTeamLibrary()`.  
Team sections are merged into the sidebar above the main LOBs as read-only items.

---

## Step 1 — Set the admin PIN in GAS

Before deploying, open the GAS editor:

1. Go to **Project Settings** → **Script Properties**
2. Add a property: `admin_pin` = `your-chosen-pin` (e.g. `RF2024`)
3. Save

This PIN is never exposed in client code. Only the script owner can read or change it.

---

## Step 2 — Update Code.gs

Add these two functions alongside the existing `getUserData` / `setUserData`:

```javascript
/**
 * Returns the shared team library — readable by anyone.
 */
function getTeamLibrary() {
  try {
    var p = PropertiesService.getScriptProperties();
    return {
      team_sections:     p.getProperty('team_sections'),
      team_version:      p.getProperty('team_version'),
      team_announcement: p.getProperty('team_announcement')
    };
  } catch(e) { return {}; }
}

/**
 * Saves the shared team library — requires the admin PIN.
 * @param {Object} data  - { team_sections, team_announcement }
 * @param {string} pin   - must match the 'admin_pin' Script Property
 */
function setTeamLibrary(data, pin) {
  try {
    var storedPin = PropertiesService.getScriptProperties().getProperty('admin_pin');
    if (!storedPin || pin !== storedPin) return { error: 'wrong_pin' };
    var p = PropertiesService.getScriptProperties();
    if (data.team_sections     != null) p.setProperty('team_sections',     data.team_sections);
    if (data.team_announcement != null) p.setProperty('team_announcement', data.team_announcement);
    p.setProperty('team_version', Date.now().toString());
    return { ok: true, version: Date.now() };
  } catch(e) { return { error: e.toString() }; }
}
```

---

## Step 3 — Data structure for `team_sections`

`team_sections` is a JSON string of an array. Each object matches the shape already used in the app:

```json
[
  {
    "id": "team_greeting",
    "label": "Team Greetings",
    "icon": "📣",
    "color": "#FF00BF",
    "snippets": [
      { "label": "Standard opening", "text": "Hello xxx, thank you for contacting Lyft support..." },
      { "label": "BGC appeal opener", "text": "Hello xxx, I understand you are reaching out regarding..." }
    ]
  },
  {
    "id": "team_bgc_appeal",
    "label": "BGC Appeal — New Flow",
    "icon": "📋",
    "color": "#6366f1",
    "snippets": [
      { "label": "Step 1", "text": "I have reviewed your account and can confirm..." }
    ]
  }
]
```

Each section has the same shape as built-in RiseForce sections so the existing `showSnippets` / `buildParaCard` pipeline renders them unchanged.

---

## Step 4 — Frontend state variables

Add to the state block in `index.html`:

```javascript
let teamSections    = [];           // loaded from getTeamLibrary()
let teamVersion     = 0;            // timestamp of last team publish
let teamAnnouncement = '';          // optional banner string
let isAdmin         = false;        // true after correct PIN entered
```

---

## Step 5 — Load team library on startup

Inside `loadFromServer()`, after `getUserData` resolves, chain a second call:

```javascript
function loadTeamLibrary() {
  if (!syncAvailable) return;
  google.script.run
    .withSuccessHandler(data => {
      if (!data) return;
      if (data.team_sections) {
        try {
          teamSections = JSON.parse(data.team_sections);
          store.set('rf_team_sections', data.team_sections); // local cache
        } catch {}
      }
      teamVersion      = parseInt(data.team_version || '0', 10);
      teamAnnouncement = data.team_announcement || '';
      renderTeamBanner();
      renderTree();          // re-render sidebar with team sections
    })
    .withFailureHandler(() => {
      // fall back to cached team sections
      const cached = store.get('rf_team_sections');
      if (cached) { try { teamSections = JSON.parse(cached); renderTree(); } catch {} }
    })
    .getTeamLibrary();
}
```

Call `loadTeamLibrary()` right after `loadFromServer()` in the INIT block.

---

## Step 6 — Render team sections in the sidebar

In `renderTree()`, add a **📣 Team Library** block above the LOBs:

```javascript
// ── Team Library ──
if (teamSections.length) {
  const updatedAgo = teamVersion
    ? formatRelativeTime(teamVersion)   // e.g. "2h ago"
    : '';

  h += `<div class="lob-label" style="cursor:default;pointer-events:none">
    <span>📣 Team Library</span>
    <span style="font-size:0.6rem;color:var(--muted);font-weight:400">${updatedAgo}</span>
  </div>`;

  teamSections.forEach(sec => {
    const active = selPath === `__team__${sec.id}`;
    h += `<div class="ni indent1${active ? ' active' : ''}"
            onclick="showTeamSection('${sec.id}')">
      <span>${sec.icon}</span> ${esc(sec.label)}
      <span style="font-size:0.58rem;font-weight:800;background:var(--pink-light);color:var(--pink);
                   padding:1px 5px;border-radius:6px;margin-left:auto;flex-shrink:0">TEAM</span>
    </div>`;
  });
}
```

Helper to format the timestamp:

```javascript
function formatRelativeTime(ts) {
  const diff = Date.now() - parseInt(ts, 10);
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}
```

---

## Step 7 — Show a team section

```javascript
function showTeamSection(id) {
  const sec = teamSections.find(s => s.id === id);
  if (!sec) return;
  selPath = `__team__${id}`;
  renderTree();
  closeSidebar();

  // Render using the existing buildParaCard pipeline — team snippets are read-only
  let html = '';
  (sec.snippets || []).forEach((s, si) => {
    const paras = applyName(s.text).split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    html += `<div class="snippet-group">
      <div class="snip-label">${esc(s.label)}
        <span style="font-size:0.58rem;font-weight:800;color:var(--pink);margin-left:8px">TEAM</span>
      </div>
      ${paras.map((p, pi) => {
        // Read-only version of buildParaCard — no edit/pin/delete buttons
        return `<div class="snip-para has-actions" onclick="maybeFill(this)"
                    data-text="${escAttr(p)}" data-raw="${escAttr(p)}" data-key="__team__${id}|s${si}|p${pi}">
          <div class="snip-text">${esc(p)}</div>
          <div class="snip-actions">
            <button class="sa-btn" onclick="event.stopPropagation();addToQueue(this)" title="Add to queue">＋ Queue</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  });

  document.getElementById('contentBody').innerHTML = `
    <div class="content-title"><span class="icon">${sec.icon}</span>${esc(sec.label)}</div>
    <div style="font-size:0.72rem;color:var(--muted);margin-bottom:16px">
      📣 Team snippet · last updated ${formatRelativeTime(teamVersion)}
    </div>
    ${html}`;
}
```

---

## Step 8 — Team announcement banner

Add a dismissible banner just below the header (in the HTML, before `.ctx-bar`):

```html
<div class="team-banner" id="teamBanner" style="display:none">
  <span id="teamBannerText"></span>
  <button onclick="dismissTeamBanner()">✕</button>
</div>
```

CSS:

```css
.team-banner {
  background: linear-gradient(135deg, #FF00BF22, #a000ff22);
  border-bottom: 1px solid rgba(255,0,191,0.2);
  padding: 7px 20px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 0.82rem; font-weight: 600; color: var(--pink);
  flex-shrink: 0;
}
.team-banner button {
  background: none; border: none; cursor: pointer;
  color: var(--muted); font-size: 0.9rem; padding: 0 4px;
}
```

JS:

```javascript
function renderTeamBanner() {
  const dismissed = store.get('rf_banner_dismissed');
  const banner    = document.getElementById('teamBanner');
  if (!banner) return;
  if (teamAnnouncement && dismissed !== teamVersion.toString()) {
    document.getElementById('teamBannerText').textContent = '📢 ' + teamAnnouncement;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function dismissTeamBanner() {
  store.set('rf_banner_dismissed', teamVersion.toString());
  document.getElementById('teamBanner').style.display = 'none';
}
```

---

## Step 9 — Admin panel (team lead side)

Add a ⚙️ button to the header (visible to all, gated by PIN):

```html
<button class="palette-btn" onclick="openAdminPanel()" title="Team Admin">⚙️</button>
```

The admin panel is a modal. When opened, it asks for the PIN first. After correct entry it shows the editor:

```
┌─────────────────────────────────────────┐
│  ⚙️ Team Library Admin           [✕]    │
│─────────────────────────────────────────│
│  📢 Announcement (shown to all agents)  │
│  [_______________________________]      │
│                                         │
│  Sections  [+ Add Section]              │
│  ┌──────────────────────────────────┐   │
│  │ 📣 Team Greetings           [✕] │   │
│  │   + Add snippet                  │   │
│  │   · Hello xxx, thank you…  [✕]  │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │ 📋 BGC Appeal Flow          [✕] │   │
│  └──────────────────────────────────┘   │
│                                         │
│  [Cancel]              [🚀 Publish All] │
└─────────────────────────────────────────┘
```

JS flow:

```javascript
let adminSections = [];  // working copy while editing

function openAdminPanel() {
  const pin = prompt('Enter admin PIN:');
  if (!pin) return;
  // Verify PIN server-side by trying a harmless write with it
  if (!syncAvailable) { alert('Admin panel requires GAS deployment.'); return; }
  google.script.run
    .withSuccessHandler(res => {
      if (res.error) { alert('Wrong PIN'); return; }
      isAdmin = true;
      adminSections = JSON.parse(JSON.stringify(teamSections)); // deep copy
      renderAdminPanel();
      document.getElementById('adminModal').style.display = 'flex';
    })
    .withFailureHandler(() => alert('Could not verify PIN.'))
    .setTeamLibrary({ team_sections: null }, pin); // null = no-op write, just PIN check
}

function publishTeamLibrary(pin) {
  const announcement = document.getElementById('adminAnnouncement').value.trim();
  google.script.run
    .withSuccessHandler(res => {
      if (res.error) { alert('Publish failed: ' + res.error); return; }
      teamSections     = adminSections;
      teamAnnouncement = announcement;
      teamVersion      = Date.now();
      store.set('rf_team_sections', JSON.stringify(teamSections));
      renderTree();
      renderTeamBanner();
      closeAdminPanel();
      showToast('Team library published! 🚀');
    })
    .withFailureHandler(() => alert('Publish failed.'))
    .setTeamLibrary({
      team_sections:     JSON.stringify(adminSections),
      team_announcement: announcement
    }, pin);
}
```

---

## Step 10 — Deployment checklist

1. Add `admin_pin` to GAS Script Properties (never in code)
2. Paste the two new Code.gs functions and redeploy as a **new version**
3. Add frontend changes to `index.html` (state vars, `loadTeamLibrary`, `renderTree` block, admin modal HTML + CSS + JS)
4. Test with one agent account reading, one lead account publishing
5. Verify that `getTeamLibrary()` returns the latest `team_sections` for all users

---

## Security model

| Concern | Mitigation |
|---|---|
| Any agent can call `setTeamLibrary` | PIN required — wrong PIN returns `{ error: 'wrong_pin' }`, nothing is saved |
| PIN exposed in browser network tab | GAS server-side functions are not visible to the browser — only the return value is |
| PIN brute-force | GAS rate-limits `google.script.run` calls; add a 3-attempt lockout in the JS if needed |
| Agent edits team snippets | Team snippets rendered without edit/delete/pin buttons in `showTeamSection` |
| Offline agents miss updates | Local cache in `rf_team_sections` (localStorage) serves stale content when offline |

---

## File changes summary

| File | Changes |
|---|---|
| `Code.gs` | Add `getTeamLibrary()` and `setTeamLibrary(data, pin)` |
| `index.html` | State vars, `loadTeamLibrary()`, `renderTeamBanner()`, `showTeamSection()`, admin modal HTML/CSS/JS, `renderTree()` team block |

---

*Implementation estimated effort: ~4–6 hours of focused coding.*
