// Adds one line to this week's Notion page after a deployment. Skips quietly without NOTION_TOKEN or a page id.
import { readFileSync } from 'node:fs';

const token = process.env.NOTION_TOKEN;
if (!token) { console.log('NOTION_TOKEN is not set: no Notion log.'); process.exit(0); }
const pages = JSON.parse(readFileSync(new URL('../notion-weeks.json', import.meta.url), 'utf8'));
const week = Math.floor((Date.now() - Date.UTC(2026, 9, 26)) / (7 * 24 * 3600 * 1000)) + 1;
const page = pages[String(week)];
if (!page) { console.log(`No Notion page for week ${week} in notion-weeks.json: skipped.`); process.exit(0); }

const text = `${new Date().toISOString().slice(0, 10)} showcase deployed (${(process.env.GITHUB_SHA || 'local').slice(0, 7)}): https://real2twin-showcase.nadafeniche00.workers.dev`;
const r = await fetch(`https://api.notion.com/v1/blocks/${page}/children`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
  body: JSON.stringify({ children: [{ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: text } }] } }] }),
});
if (!r.ok) { console.error(`Notion answered ${r.status}`); process.exit(1); }
console.log(`Notion week ${week}: logged.`);
