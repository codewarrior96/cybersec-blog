/**
 * Phase 6: centralized email template module.
 *
 * All transactional email rendering lives here. Two render functions:
 *   - renderVerificationEmail (Phase 3+4 — register, /verify/resend)
 *   - renderPasswordResetEmail (Phase 5 — /forgot)
 *
 * Each returns `{ subject, html, text }` so the email client can pick
 * the appropriate part and so plain-text-only readers still get a
 * readable message.
 *
 * Design constraints:
 *  - INLINE CSS ONLY. Email clients (Gmail, Outlook, Apple Mail) strip
 *    `<style>` blocks; rendered styling MUST come from `style="..."`
 *    attributes on individual elements.
 *  - No external assets. Logo is an inline SVG in the header. The
 *    `<img src="...">` route would require us to host on a CDN with
 *    correct CORS, plus many clients block remote images by default
 *    until the recipient clicks "show images." Inline SVG renders
 *    instantly without that consent step.
 *  - Dark + neon-green palette matches the in-app /login + /register
 *    aesthetic. We accept that some recipients have light-mode email
 *    clients that may auto-invert; the dark variant remains legible
 *    after invert.
 *  - Brand mark: chevron-and-underscore SVG (matches public/icon.svg).
 *    Reused below in BRAND_MARK_SVG so a logo update propagates to
 *    every transactional email by editing one constant.
 *  - Footer: 'siberlab — cybersecurity learning lab' + From address,
 *    consistent across every template, anchors brand consistency
 *    independently of the per-email content above it.
 */

interface VerificationEmailParams {
  username: string
  verifyUrl: string
}

interface PasswordResetEmailParams {
  username: string
  resetUrl: string
}

interface RenderedEmail {
  subject: string
  html: string
  text: string
}

// Inline brand mark — chevron + underscore in neon green (#00ff41).
// Mirrors public/icon.svg shape; sized down to 28×28 for in-email
// header use. Inlined so no remote asset request happens at render
// time (Gmail blocks remote images by default).
const BRAND_MARK_SVG = `<svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;display:inline-block;"><path d="M 36 18 L 72 50 L 36 82" stroke="#00ff41" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="30" y="86" width="50" height="6" fill="#00ff41"/></svg>`

const FONT_MONO =
  "'JetBrains Mono','Fira Code','SFMono-Regular',Menlo,Consolas,monospace"
const FONT_SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"

/**
 * Shared HTML scaffolding around the per-email body. Header carries the
 * brand mark + 'siberlab' wordmark; footer carries the from-address +
 * tagline. Body is a parameterized HTML string injected verbatim — each
 * template renderer supplies its own opinionated content.
 */
function renderShell({
  preheader,
  bodyHtml,
}: {
  preheader: string
  bodyHtml: string
}): string {
  // The preheader is the snippet email clients show in the inbox list
  // (after the subject). Hidden from view via display:none + maxHeight,
  // but still present in the DOM so Gmail's algorithm picks it up
  // instead of falling back to the first visible text.
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#000;font-family:${FONT_SANS};color:#e2e8f0;">
<div style="display:none;font-size:1px;color:#000;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#000;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#040806;border:1px solid rgba(0,255,65,0.25);border-radius:12px;overflow:hidden;">
      <tr><td style="padding:20px 24px;border-bottom:1px solid rgba(0,255,65,0.15);">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
          <td style="vertical-align:middle;">${BRAND_MARK_SVG}<span style="margin-left:10px;font-family:${FONT_MONO};color:#00ff41;letter-spacing:0.18em;font-size:13px;font-weight:700;vertical-align:middle;">siberlab</span></td>
          <td align="right" style="font-family:${FONT_MONO};font-size:10px;color:rgba(0,255,65,0.45);letter-spacing:0.18em;text-transform:uppercase;vertical-align:middle;">Transactional</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 24px;">${bodyHtml}</td></tr>
      <tr><td style="padding:18px 24px;border-top:1px solid rgba(0,255,65,0.12);font-family:${FONT_MONO};font-size:10px;color:#64748b;letter-spacing:0.06em;line-height:1.6;">
        siberlab — cybersecurity learning lab<br/>
        <span style="color:rgba(0,255,65,0.45);">noreply@siberlab.dev</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/**
 * Verification email — sent at register and via /api/auth/verify/resend.
 * 24-hour token TTL is referenced in copy; updating the literal here
 * without updating the route TTL (or vice versa) creates user-facing
 * inconsistency, so the value lives in two places by design (a
 * shared-constant refactor would couple the email module to the route
 * module, which we don't want).
 */
export function renderVerificationEmail(
  params: VerificationEmailParams,
): RenderedEmail {
  const safeName = params.username || 'Operator'
  const subject = 'siberlab — Email adresini doğrula'
  const preheader = 'Hesabını aktive etmek için email adresini doğrula.'
  const text = [
    `Merhaba ${safeName},`,
    '',
    'siberlab hesabını oluşturduğunu görüyorum. Email adresini doğrulamak için aşağıdaki bağlantıya tıkla:',
    '',
    params.verifyUrl,
    '',
    'Bu bağlantı 24 saat geçerli. Sen istemediysen bu maili görmezden gelebilirsin.',
    '',
    '— siberlab',
  ].join('\n')
  const bodyHtml = `
<h1 style="margin:0 0 16px;font-family:${FONT_SANS};font-size:22px;font-weight:600;color:#f8fafc;letter-spacing:0.01em;">Email adresini doğrula</h1>
<p style="margin:0 0 14px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:#cbd5e1;">Merhaba ${safeName}, siberlab hesabını oluşturdun. Aşağıdaki bağlantıya tıklayarak email adresini doğrula:</p>
<p style="margin:24px 0;text-align:center;">
  <a href="${params.verifyUrl}" style="display:inline-block;background:#00ff41;color:#000;padding:12px 24px;border-radius:8px;font-family:${FONT_MONO};font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.12em;text-transform:uppercase;">Email adresini doğrula</a>
</p>
<p style="margin:0 0 8px;font-family:${FONT_SANS};font-size:12px;line-height:1.6;color:#94a3b8;">Bağlantı 24 saat geçerli. Çalışmıyorsa şu URL'yi tarayıcına yapıştırabilirsin:</p>
<p style="margin:0 0 16px;font-family:${FONT_MONO};font-size:11px;line-height:1.5;color:#00ff41;word-break:break-all;background:rgba(0,255,65,0.04);padding:10px 12px;border-radius:6px;border:1px solid rgba(0,255,65,0.18);">${params.verifyUrl}</p>
<p style="margin:16px 0 0;font-family:${FONT_SANS};font-size:11px;line-height:1.6;color:#64748b;">Sen istemediysen bu maili görmezden gelebilirsin.</p>`
  return {
    subject,
    html: renderShell({ preheader, bodyHtml }),
    text,
  }
}

/**
 * Password reset email — sent by /api/auth/forgot when an account
 * exists AND emailVerified=true. 1-hour token TTL is shorter than the
 * verification token (24h) because reset is more sensitive — a leaked
 * reset link grants the attacker a password, vs. the verify link which
 * only flips emailVerified.
 *
 * The amber security note ("if you didn't request this, ignore — your
 * password won't change") is a standard anti-phishing affordance:
 * legitimate users receiving an unsolicited reset email get a clear
 * explanation that no action is required and that their existing
 * credentials remain valid.
 */
export function renderPasswordResetEmail(
  params: PasswordResetEmailParams,
): RenderedEmail {
  const safeName = params.username || 'Operator'
  const subject = 'siberlab — Şifre sıfırlama'
  const preheader = 'Şifre sıfırlama bağlantın hazır. 1 saat geçerli.'
  const text = [
    `Merhaba ${safeName},`,
    '',
    'siberlab hesabın için şifre sıfırlama talebi aldık. Yeni bir şifre belirlemek için aşağıdaki bağlantıya tıkla:',
    '',
    params.resetUrl,
    '',
    'Bu bağlantı 1 saat geçerli. Süre dolarsa yeni bir bağlantı talep etmen gerekir.',
    '',
    'Eğer bu talebi sen yapmadıysan, bu maili görmezden gelebilirsin — şifren değişmez.',
    '',
    '— siberlab',
  ].join('\n')
  const bodyHtml = `
<h1 style="margin:0 0 16px;font-family:${FONT_SANS};font-size:22px;font-weight:600;color:#f8fafc;letter-spacing:0.01em;">Şifre sıfırlama</h1>
<p style="margin:0 0 14px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:#cbd5e1;">Merhaba ${safeName}, siberlab hesabın için şifre sıfırlama talebi aldık. Yeni bir şifre belirlemek için aşağıdaki bağlantıya tıkla:</p>
<p style="margin:24px 0;text-align:center;">
  <a href="${params.resetUrl}" style="display:inline-block;background:#00ff41;color:#000;padding:12px 24px;border-radius:8px;font-family:${FONT_MONO};font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.12em;text-transform:uppercase;">Yeni şifre belirle</a>
</p>
<p style="margin:0 0 8px;font-family:${FONT_SANS};font-size:12px;line-height:1.6;color:#94a3b8;">Bağlantı 1 saat geçerli. Çalışmıyorsa şu URL'yi tarayıcına yapıştırabilirsin:</p>
<p style="margin:0 0 16px;font-family:${FONT_MONO};font-size:11px;line-height:1.5;color:#00ff41;word-break:break-all;background:rgba(0,255,65,0.04);padding:10px 12px;border-radius:6px;border:1px solid rgba(0,255,65,0.18);">${params.resetUrl}</p>
<div style="margin:16px 0 0;padding:12px 14px;border-top:1px solid rgba(245,158,11,0.25);background:rgba(245,158,11,0.04);border-radius:6px;">
  <p style="margin:0;font-family:${FONT_SANS};font-size:12px;line-height:1.6;color:#fbbf24;">⚠ Bu talebi sen yapmadıysan, bu maili görmezden gelebilirsin — şifren değişmez. Yine de hesabının güvende olduğundan emin değilsen, mevcut şifrenle giriş yap ve değiştir.</p>
</div>`
  return {
    subject,
    html: renderShell({ preheader, bodyHtml }),
    text,
  }
}
