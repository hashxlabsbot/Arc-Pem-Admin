// Shared ARC PEM email layout: a copy of ARCPEM-Web src/lib/email/layout.ts. Keep the three copies identical.
/**
 * The one layout every ARC PEM email uses, in the official brand (the ARC PEM logo and arcpem.com): the violet→blue
 * gradient, indigo as the action colour, slate text on white. Table-based with inline styles, because that is what
 * Gmail, Outlook and Apple Mail render consistently. Gradients degrade to solid indigo where unsupported (Outlook),
 * and the wordmark is text, so the email still reads as ARC PEM when images are blocked. Every piece of text passed
 * in is escaped here, since names and firm names are typed by users.
 *
 * Pure (no server imports) so templates can be rendered and tested anywhere.
 */

/** Brand tokens, matching arcpem.com (app/globals.css there) and the logo. */
const C = {
  violet: "#7c3aed",
  indigo: "#6366f1",
  indigoDark: "#4f46e5",
  blue: "#3b82f6",
  ink: "#0f172a",
  inkLight: "#1e293b",
  body: "#475569",
  subtle: "#64748b",
  faint: "#94a3b8",
  canvas: "#f1f5f9",
  card: "#ffffff",
  panel: "#f8fafc",
  line: "#e2e8f0",
  infoBg: "#eef2ff",
  infoLine: "#c7d2fe",
  infoInk: "#3730a3",
  warnBg: "#fffbeb",
  warnLine: "#fde68a",
  warnInk: "#92400e",
};
const BRAND_GRADIENT = `linear-gradient(90deg, ${C.violet} 0%, ${C.indigo} 50%, ${C.blue} 100%)`;
const BUTTON_GRADIENT = `linear-gradient(135deg, ${C.blue} 0%, ${C.indigo} 100%)`;

const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Content-ID of the inline logo the mailer attaches (see mailer.ts). */
export const LOGO_CID = "arcpem-logo";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A paragraph. `**bold**` spans are the only markup allowed; everything else is escaped. */
export type Paragraph = string;

export type EmailContent = {
  /** Shown by inboxes next to the subject; never visible in the email itself. */
  preheader: string;
  /** Small caps line above the heading, e.g. "Team invitation". */
  eyebrow: string;
  heading: string;
  paragraphs: Paragraph[];
  /** A one-time code shown large (verification and reset codes). */
  code?: { value: string; caption: string };
  /** A short list: numbered steps or bullet points. */
  list?: { title: string; items: Paragraph[]; ordered?: boolean };
  /** Key facts shown in a panel (Firm, Role, Expires …). */
  details?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  /** A highlighted note under the button (security advice, expiry). */
  note?: { text: Paragraph; tone?: "info" | "warning" };
  /** Last lines in the card, e.g. "If you didn't ask for this, ignore this email." */
  closing?: Paragraph[];
  /** Why the person got this email, shown in the footer. */
  reason: string;
};

const rich = (p: Paragraph) =>
  escapeHtml(p).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.ink};font-weight:600;">$1</strong>`);
const plain = (p: Paragraph) => p.replace(/\*\*(.+?)\*\*/g, "$1");

function paragraphHtml(p: Paragraph, last: boolean) {
  return `<p style="margin:0 0 ${last ? 0 : 16}px;font-size:15px;line-height:25px;color:${C.body};">${rich(p)}</p>`;
}

function detailsHtml(details: NonNullable<EmailContent["details"]>) {
  const rows = details
    .map(
      (d, i) => `<tr>
        <td style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-size:13px;line-height:20px;color:${C.subtle};width:40%;vertical-align:top;">${escapeHtml(d.label)}</td>
        <td align="right" style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-size:14px;line-height:20px;color:${C.ink};font-weight:700;vertical-align:top;">${escapeHtml(d.value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;background:${C.panel};border:1px solid ${C.line};border-radius:14px;">
    <tr><td style="padding:6px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
  </table>`;
}

function codeHtml(code: NonNullable<EmailContent["code"]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;">
    <tr><td align="center" style="padding:24px 16px;background:${C.infoBg};border:1px solid ${C.infoLine};border-radius:14px;">
      <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;line-height:40px;font-weight:800;letter-spacing:10px;color:${C.ink};">${escapeHtml(code.value)}</div>
      <div style="padding-top:8px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.indigo};">${escapeHtml(code.caption)}</div>
    </td></tr>
  </table>`;
}

function listHtml(list: NonNullable<EmailContent["list"]>) {
  const rows = list.items
    .map(
      (item, i) => `<tr>
        <td width="30" valign="top" style="padding:7px 0;"><div style="width:22px;height:22px;border-radius:11px;background:${C.infoBg};color:${C.indigo};font-size:12px;line-height:22px;font-weight:800;text-align:center;">${list.ordered ? i + 1 : "&#10003;"}</div></td>
        <td valign="top" style="padding:8px 0 7px;font-size:14px;line-height:21px;color:${C.body};">${rich(item)}</td>
      </tr>`,
    )
    .join("");
  return `<p style="margin:26px 0 6px;font-size:12px;line-height:18px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${C.subtle};">${escapeHtml(list.title)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function buttonHtml(cta: NonNullable<EmailContent["cta"]>) {
  const url = escapeHtml(cta.url);
  // "Bulletproof" button: the padded cell is the button, so it renders even where <a> padding is ignored (Outlook),
  // and its solid indigo bgcolor stands in where the gradient isn't supported.
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 0;">
    <tr><td align="center" bgcolor="${C.indigoDark}" style="border-radius:12px;background:${C.indigoDark};background-image:${BUTTON_GRADIENT};">
      <a href="${url}" target="_blank" style="display:inline-block;padding:15px 32px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(cta.label)} &rarr;</a>
    </td></tr>
  </table>
  <p style="margin:18px 0 0;font-size:12px;line-height:18px;color:${C.faint};">Button not working? Paste this link into your browser:<br>
    <a href="${url}" target="_blank" style="color:${C.indigoDark};word-break:break-all;">${url}</a></p>`;
}

function noteHtml(note: NonNullable<EmailContent["note"]>) {
  const warn = note.tone === "warning";
  const [bg, line, ink] = warn ? [C.warnBg, C.warnLine, C.warnInk] : [C.infoBg, C.infoLine, C.infoInk];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;">
    <tr><td style="padding:14px 18px;border-radius:12px;background:${bg};border:1px solid ${line};font-size:13px;line-height:21px;color:${ink};">${rich(note.text).replace(new RegExp(`color:${C.ink}`, "g"), `color:${ink}`)}</td></tr>
  </table>`;
}

/** The ARC PEM lockup: icon (when it loads) plus the wordmark and tagline as text, so it never depends on images. */
function brandHtml(logoUrl?: string) {
  const icon = logoUrl
    ? `<td style="vertical-align:middle;padding-right:12px;"><img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="" style="display:block;border:0;outline:none;width:40px;height:40px;"></td>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    ${icon}
    <td style="vertical-align:middle;">
      <div style="font-size:20px;line-height:22px;font-weight:900;letter-spacing:0.01em;color:${C.ink};">ARC <span style="color:${C.indigo};">PEM</span></div>
      <div style="padding-top:3px;font-size:9px;line-height:12px;font-weight:700;letter-spacing:0.22em;color:${C.faint};">PLAN &bull; ENGINEER &bull; MANAGE</div>
    </td>
  </tr></table>`;
}

/** Renders an email as HTML plus a plain-text version for clients that don't show HTML. */
export function renderEmail(content: EmailContent, opts: { appUrl?: string; logoUrl?: string } = {}) {
  const { preheader, eyebrow, heading, paragraphs, code, list, details, cta, note, closing, reason } =
    content;
  const appLink = opts.appUrl
    ? ` &middot; <a href="${escapeHtml(opts.appUrl)}" style="color:${C.subtle};text-decoration:none;">${escapeHtml(opts.appUrl.replace(/^https?:\/\//, ""))}</a>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(heading)}</title>
<style>
  @media (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .h1 { font-size: 23px !important; line-height: 31px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};">
  <tr><td align="center" style="padding:36px 12px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;font-family:${FONT};">

      <tr><td style="height:5px;line-height:5px;font-size:0;border-radius:18px 18px 0 0;background:${C.indigo};background-image:${BRAND_GRADIENT};">&nbsp;</td></tr>
      <tr><td class="px" style="background:${C.card};padding:26px 44px 22px;border-left:1px solid ${C.line};border-right:1px solid ${C.line};border-bottom:1px solid ${C.line};">
        ${brandHtml(opts.logoUrl)}
      </td></tr>

      <tr><td class="px" style="background:${C.card};padding:38px 44px 40px;border-left:1px solid ${C.line};border-right:1px solid ${C.line};">
        <p style="margin:0 0 12px;font-size:11px;line-height:16px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${C.indigo};">${escapeHtml(eyebrow)}</p>
        <h1 class="h1" style="margin:0 0 20px;font-size:26px;line-height:34px;font-weight:900;color:${C.ink};letter-spacing:-0.025em;">${escapeHtml(heading)}</h1>
        ${paragraphs.map((p, i) => paragraphHtml(p, i === paragraphs.length - 1)).join("")}
        ${code ? codeHtml(code) : ""}
        ${list?.items.length ? listHtml(list) : ""}
        ${details?.length ? detailsHtml(details) : ""}
        ${cta ? buttonHtml(cta) : ""}
        ${note ? noteHtml(note) : ""}
        ${
          closing?.length
            ? `<div style="margin:30px 0 0;padding-top:22px;border-top:1px solid ${C.line};">${closing
                .map(
                  (p) =>
                    `<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:${C.subtle};">${rich(p)}</p>`,
                )
                .join("")}</div>`
            : ""
        }
      </td></tr>

      <tr><td class="px" style="background:${C.card};border:1px solid ${C.line};border-top:0;border-radius:0 0 18px 18px;padding:0 44px 30px;">
        <p style="margin:0;font-size:14px;line-height:20px;color:${C.inkLight};font-weight:600;">The ARC PEM team</p>
      </td></tr>

      <tr><td align="center" style="padding:26px 24px 0;">
        <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:${C.faint};">${escapeHtml(reason)}</p>
        <p style="margin:0;font-size:12px;line-height:18px;color:${C.subtle};"><strong style="color:${C.inkLight};">ARC PEM</strong> &middot; Plan &bull; Engineer &bull; Manage${appLink} &middot; <a href="https://arcpem.com" style="color:${C.subtle};text-decoration:none;">arcpem.com</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs.map(plain).flatMap((p) => [p, ""]),
    ...(code ? [`${code.value}  (${code.caption})`, ""] : []),
    ...(list?.items.length
      ? [list.title, ...list.items.map((item, i) => `${list.ordered ? `${i + 1}.` : "-"} ${plain(item)}`), ""]
      : []),
    ...(details?.length ? [...details.map((d) => `${d.label}: ${d.value}`), ""] : []),
    ...(cta ? [`${cta.label}:`, cta.url, ""] : []),
    ...(note ? [plain(note.text), ""] : []),
    ...(closing?.length ? [...closing.map(plain), ""] : []),
    "The ARC PEM team",
    "",
    reason,
    "ARC PEM · Plan • Engineer • Manage · arcpem.com",
  ].join("\n");

  return { html, text };
}
