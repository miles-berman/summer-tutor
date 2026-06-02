## Getting started

- Open the link your teacher gives you
- Type a name for your website (this becomes your folder name)
- You'll see two tabs — `index.html` and `styles.css` — and a live preview on the right

No setup, no install. It all runs in your browser.

## How it works

Your website is just two files:

- **`index.html`** — the stuff *on* the page (headings, words, lists)
- **`styles.css`** — how it *looks* (colors, sizes, spacing)

The preview updates as you type. There's no save button — your work saves automatically.

**Key idea:** HTML is *what's there*. CSS is *how it looks*.

## 1. Edit your words

Open the `index.html` tab. Find the text and change it to be about you.

```html
<h1>Hi, I'm Your Name</h1>
<p class="tagline">I make cool stuff on the internet.</p>
```

- `<h1>` is a big heading
- `<p>` is a paragraph
- Whatever you type between the tags shows up on the page

## 2. Add to your lists

```html
<ul>
  <li>Video games</li>
  <li>Drawing</li>
</ul>
```

- `<ul>` is the list
- each `<li>` is one item — copy a line to add more

## 3. Change the colors

Open the `styles.css` tab. The colors live at the very top:

```css
:root {
  --bg: #fdf6e3;
  --text: #333;
  --accent: #e85d75;
}
```

Change one color code and watch the whole page change. Try it!

**Key idea:** change the color in *one* place (`--accent`), and every heading and line that uses it updates at once.

## 4. Hand it in

- Click **Download this site**
- A file lands in your Downloads
- Send that file to your teacher — done!

**Gotcha:** your work only lives in *this* browser on *this* computer. If you switch computers it won't follow you — so click **Download** when you're finished.

## Cheatsheet

Common tags for `index.html`:

|Tag|What it does|
|---|---|
|`<h1>` `<h2>`|Headings (big to smaller)|
|`<p>`|A paragraph of text|
|`<ul>` / `<li>`|A bullet list / one list item|
|`<a href="...">`|A link to another page|
|`<img src="...">`|An image|

Common settings for `styles.css`:

|Property|What it does|
|---|---|
|`color`|Text color|
|`background`|Background color|
|`font-size`|How big the text is|
|`text-align`|`left`, `center`, or `right`|
|`padding`|Space *inside* a box|
|`margin`|Space *outside* a box|