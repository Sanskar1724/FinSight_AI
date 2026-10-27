import re, sys, html
import markdown

src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()

m = re.match(r"#\s+(.+)\n", text)
headline = m.group(1).strip()
text = text[m.end():]

md = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "sane_lists"],
                       extension_configs={"toc": {"toc_depth": "2-3"}})
body = md.convert(text)
body = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', body)
body = re.sub(r"<table>", '<div class="tbl"><table>', body)
body = body.replace("</table>", "</table></div>")

# First paragraph becomes the lede
body = body.replace("<p>", '<p class="lede">', 1)

toc_items = []
for tok in md.toc_tokens:
    toc_items.append(f'<li><a href="#{tok["id"]}">{tok["name"]}</a></li>')
toc = "\n".join(toc_items)

page = f"""<title>FinSight Multi-Agent Research</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Serif:wght@500;600&display=swap">
<style>
/* Layout: research dossier. Sticky contents rail on wide screens, single reading column on phones. */
:root {{
  --bg: #f6f8f7;
  --surface: #ffffff;
  --fg: #17211f;
  --muted: #56645f;
  --rule: #d7dfdc;
  --accent: #0c6b58;
  --accent-soft: #e2f0eb;
  --mark: #b06a00;
  --display: "IBM Plex Serif", Georgia, "Times New Roman", serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #0f1514; --surface: #151d1b; --fg: #e4ebe8; --muted: #9aaaa4; --rule: #2a3633;
  --accent: #5ccfae; --accent-soft: #17302a; --mark: #f0b45a; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #0f1514; --surface: #151d1b; --fg: #e4ebe8; --muted: #9aaaa4; --rule: #2a3633;
  --accent: #5ccfae; --accent-soft: #17302a; --mark: #f0b45a; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--fg); font: 16px/1.65 var(--body); }}
.wrap {{ max-width: 1180px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 40px 80px; }}
header.hero {{ border-bottom: 1px solid var(--rule); padding-bottom: 28px; margin-bottom: 36px; }}
.eyebrow {{ font: 500 12px/1.4 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }}
h1 {{ font: 600 clamp(30px, 5vw, 46px)/1.12 var(--display); margin: 10px 0 14px; text-wrap: balance; max-width: 24ch; }}
.meta {{ display: flex; flex-wrap: wrap; gap: 8px 20px; font: 13px/1.5 var(--mono); color: var(--muted); }}
.layout {{ display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 56px; }}
nav.toc {{ position: sticky; top: calc(env(safe-area-inset-top, 0px) + 24px); align-self: start; font-size: 14px; }}
nav.toc .label {{ font: 500 11px/1 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }}
nav.toc ol {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; counter-reset: s; }}
nav.toc li {{ counter-increment: s; display: grid; grid-template-columns: 22px 1fr; }}
nav.toc li::before {{ content: counter(s); font: 12px/1.6 var(--mono); color: var(--accent); }}
nav.toc a {{ color: var(--fg); text-decoration: none; line-height: 1.4; }}
nav.toc a:hover {{ color: var(--accent); }}
article {{ min-width: 0; max-width: 72ch; }}
article h2 {{ font: 600 clamp(22px, 3vw, 28px)/1.25 var(--display); margin: 56px 0 14px; padding-top: 18px;
  border-top: 2px solid var(--fg); text-wrap: balance; scroll-margin-top: 20px; }}
article h3 {{ font: 600 18px/1.35 var(--body); margin: 32px 0 8px; text-wrap: balance; scroll-margin-top: 20px; }}
article p, article li {{ color: var(--fg); }}
article p {{ margin: 0 0 14px; }}
article ul, article ol {{ padding-left: 22px; margin: 0 0 16px; display: grid; gap: 6px; }}
p.lede {{ font-size: 18px; line-height: 1.6; padding: 20px 22px; background: var(--surface);
  border: 1px solid var(--rule); border-radius: 6px; }}
article a {{ color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }}
article a:focus-visible, nav a:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }}
strong {{ font-weight: 600; }}
code {{ font: .88em var(--mono); background: var(--accent-soft); padding: 1px 5px; border-radius: 3px; overflow-wrap: anywhere; }}
pre {{ background: var(--surface); border: 1px solid var(--rule); border-radius: 6px; padding: 14px; overflow-x: auto; }}
pre code {{ background: none; padding: 0; overflow-wrap: normal; }}
.tbl {{ overflow-x: auto; margin: 6px 0 22px; border: 1px solid var(--rule); border-radius: 6px; background: var(--surface); }}
table {{ border-collapse: collapse; width: 100%; font-size: 14px; line-height: 1.5; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--rule); }}
th {{ font: 500 12px/1.4 var(--mono); letter-spacing: .04em; text-transform: uppercase; color: var(--muted); background: var(--bg); }}
tr:last-child td {{ border-bottom: 0; }}
blockquote {{ margin: 0 0 16px; padding: 4px 16px; border-left: 3px solid var(--mark); color: var(--muted); }}
hr {{ border: 0; border-top: 1px solid var(--rule); margin: 32px 0; }}
@media (max-width: 880px) {{
  .layout {{ grid-template-columns: minmax(0, 1fr); gap: 8px; }}
  nav.toc {{ position: static; border: 1px solid var(--rule); border-radius: 6px; padding: 16px; background: var(--surface); }}
}}
@media (prefers-reduced-motion: no-preference) {{ html {{ scroll-behavior: smooth; }} }}
</style>
<div class="wrap">
  <header class="hero">
    <div class="eyebrow">FinSight_AI · Research brief 01</div>
    <h1>{html.escape(headline)}</h1>
    <div class="meta"><span>27 Oct 2026</span><span>Prepared for San</span><span>Scope: industry, academia, benchmarks, architecture, paper plan</span></div>
  </header>
  <div class="layout">
    <nav class="toc" aria-label="Contents"><div class="label">Contents</div><ol>
{toc}
    </ol></nav>
    <article>
{body}
    </article>
  </div>
</div>
"""
open(out, "w", encoding="utf-8").write(page)
print(len(page))
