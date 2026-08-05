/**
 * Rendering an email into the two bodies every message needs.
 *
 * The visual design is unchanged — the same centred brand line in the studio's
 * colour, the same serif body, the same quiet footer. What changed is the
 * document underneath it, and the fact that a plain-text part now comes out of
 * the same call.
 *
 * Why a block model rather than HTML strings
 * ------------------------------------------
 * The old templates were HTML fragments with `<br/>` in them. There was no way
 * to produce a matching text part except by stripping tags, which produces the
 * kind of mangled text alternative that is worse than none. Here each message
 * is described as a short list of blocks, and the HTML and the text are two
 * renderings of the same list. They cannot drift, because neither is derived
 * from the other.
 */

export type Block =
  | { t: "p"; text: string }
  | { t: "lines"; items: [label: string, value: string][] }
  /** A real call to action. `text` is what a human reads; the URL is never shown. */
  | { t: "button"; label: string; href: string }
  /** For the one case where the recipient may need to copy the address by hand. */
  | { t: "fallback"; href: string }
  | { t: "quote"; text: string }
  | { t: "rule" };

export type Message = {
  /** Shown in the inbox preview line, after the subject. */
  preheader: string;
  brand: string;
  /**
   * Whether `brand` is our own name rather than a studio's.
   *
   * The brand line is set in tracked uppercase, which is the right treatment
   * for a studio's name — it reads as a letterhead. It is wrong for ours, which
   * has fixed casing: EventOS, never EVENTOS. Guest-facing mail carries the
   * studio's name and is unaffected; only the platform's own mail (access
   * requests, password resets) sets this.
   */
  wordmark?: boolean;
  color: string;
  blocks: Block[];
  /** Optional line under the footer rule, e.g. why this email was received. */
  footnote?: string;
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * A URL safe to place in an href.
 *
 * Anything that is not plainly http(s) becomes "#". A `javascript:` URL in an
 * email is inert in every modern client, but it is also a textbook spam
 * signature, and links here are always generated rather than user-supplied —
 * so rejecting the unexpected costs nothing.
 */
function safeHref(url: string) {
  return /^https?:\/\//i.test(url) ? esc(url) : "#";
}

/* ----------------------------------------------------------------- text -- */

/**
 * The plain-text alternative.
 *
 * Not optional. An HTML-only message trips `MIME_HTML_ONLY` in SpamAssassin and
 * similar rules elsewhere, and it is the single easiest deliverability point to
 * win. It is also what a screen reader in a text-first client, a smartwatch
 * notification, and a plain-text-preferring recipient actually get.
 */
export function renderText(m: Message): string {
  const out: string[] = [];

  for (const b of m.blocks) {
    switch (b.t) {
      case "p":
        out.push(wrap(b.text));
        break;
      case "lines":
        out.push(b.items.map(([k, v]) => `${k}: ${v}`).join("\n"));
        break;
      case "button":
        // The label and the URL both, because there is nothing to click.
        out.push(`${b.label}:\n${b.href}`);
        break;
      case "fallback":
        out.push(b.href);
        break;
      case "quote":
        out.push(wrap(b.text).split("\n").map(l => `  ${l}`).join("\n"));
        break;
      case "rule":
        out.push("--");
        break;
    }
  }

  out.push("--", m.brand);
  if (m.footnote) out.push(wrap(m.footnote));

  // CRLF: some older MTAs and Outlook handle bare LF inconsistently in the
  // text part, and normalising costs nothing.
  return out.join("\n\n").replace(/\r?\n/g, "\r\n") + "\r\n";
}

/** Soft-wrap at 72 columns, the long-standing convention for mail bodies. */
function wrap(s: string, width = 72) {
  return s
    .split("\n")
    .map(line => {
      const words = line.split(" ");
      const rows: string[] = [];
      let row = "";
      for (const w of words) {
        if (row && (row + " " + w).length > width) {
          rows.push(row);
          row = w;
        } else {
          row = row ? `${row} ${w}` : w;
        }
      }
      if (row) rows.push(row);
      return rows.join("\n");
    })
    .join("\n");
}

/* ----------------------------------------------------------------- html -- */

/**
 * The HTML body.
 *
 * Tables, not divs. Outlook on Windows renders mail with Word's engine, which
 * has no reliable support for max-width on a block element — a div-based
 * layout there spans the full window width and the design falls apart. A
 * centred table with a fixed width is the only construction that behaves the
 * same in Outlook, Gmail, Apple Mail and every webmail client.
 *
 * Inline styles throughout for the same reason: Gmail strips `<style>` blocks
 * in some contexts and most clients drop external stylesheets entirely. The one
 * `<style>` block below carries only the media query and the dark-mode hints,
 * which degrade harmlessly when removed.
 */
export function renderHtml(m: Message): string {
  const body = m.blocks.map(b => renderBlock(b, m.color)).join("\n");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(m.brand)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  @media only screen and (max-width:600px){
    .w{width:100%!important}
    .p{padding-left:24px!important;padding-right:24px!important}
  }
  @media (prefers-color-scheme:dark){
    .bg{background:#171513!important}
    .card{background:#1e1b19!important}
    .ink{color:#EFEAE4!important}
    .soft{color:#B3A99F!important}
  }
  a{color:${esc(m.color)}}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#F6EFEA;-webkit-font-smoothing:antialiased">
<!--
  The preheader. Mail clients show the first text in the body after the subject
  line; without one they show whatever markup happens to come first, which is
  how an email ends up previewing as "View this email in your browser" or worse.
  Hidden in the rendered message, and padded so no later content leaks into it.
-->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F6EFEA;opacity:0">
${esc(m.preheader)}${"&#847;&zwnj;&nbsp;".repeat(60)}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:#F6EFEA">
  <tr>
    <td align="center" style="padding:32px 12px">
      <table role="presentation" class="w card" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#FFFFFF;border:1px solid #EDE6DF">
        <tr>
          <td class="p" style="padding:40px 44px">

            <p style="margin:0 0 28px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:${m.wordmark ? "0.4px" : "3px"};text-transform:${m.wordmark ? "none" : "uppercase"};color:${esc(m.color)}">${esc(m.brand)}</p>

${body}

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:36px">
              <tr><td style="border-top:1px solid #EDE6DF;font-size:0;line-height:0">&nbsp;</td></tr>
            </table>
            <p class="soft" style="margin:20px 0 0;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:${m.wordmark ? "0.3px" : "2px"};text-transform:${m.wordmark ? "none" : "uppercase"};color:#A9A199">${esc(m.brand)}</p>
${m.footnote ? `            <p class="soft" style="margin:12px 0 0;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#A9A199">${esc(m.footnote)}</p>` : ""}

          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderBlock(b: Block, color: string): string {
  const serif = "font-family:Georgia,'Times New Roman',serif";
  const sans = "font-family:Helvetica,Arial,sans-serif";

  switch (b.t) {
    case "p":
      return `            <p class="ink" style="margin:0 0 18px;${serif};font-size:16px;line-height:1.75;color:#211E1B">${inline(b.text)}</p>`;

    case "lines":
      return `            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px">
${b.items
  .map(
    ([k, v]) =>
      `              <tr><td class="soft" style="padding:3px 12px 3px 0;${sans};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8B8078;white-space:nowrap;vertical-align:top">${esc(k)}</td><td class="ink" style="padding:3px 0;${serif};font-size:15px;line-height:1.6;color:#211E1B">${inline(v)}</td></tr>`,
  )
  .join("\n")}
            </table>`;

    case "button":
      // A bordered text link rather than a filled button: it matches the site,
      // and a large solid colour block is a mild spam signal in a message that
      // is otherwise almost entirely text.
      return `            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0">
              <tr><td style="border:1px solid ${esc(color)};padding:14px 30px">
                <a href="${safeHref(b.href)}" style="${sans};font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${esc(color)};text-decoration:none">${esc(b.label)}</a>
              </td></tr>
            </table>`;

    case "fallback":
      // Deliberately small and explained. A bare URL as link text is one of the
      // oldest phishing shapes there is, and filters score it accordingly — but
      // a recipient whose client blocks links still needs the address.
      return `            <p class="soft" style="margin:0 0 18px;${sans};font-size:11px;line-height:1.7;color:#8B8078;word-break:break-all">If the button does not work, copy this address into your browser:<br>${esc(b.href)}</p>`;

    case "quote":
      return `            <p class="ink" style="margin:0 0 18px;padding-left:16px;border-left:2px solid #EDE6DF;${serif};font-size:15px;line-height:1.7;font-style:italic;color:#4A423C">${inline(b.text)}</p>`;

    case "rule":
      return `            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0"><tr><td style="border-top:1px solid #EDE6DF;font-size:0;line-height:0">&nbsp;</td></tr></table>`;
  }
}

/** Escape, then restore the one bit of markup message bodies are allowed. */
function inline(s: string) {
  return esc(s).replace(/\n/g, "<br>");
}
