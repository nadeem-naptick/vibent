import { Resend } from 'resend';

// Lazy client so missing keys don't crash module load — auth flows that
// need email just error per-request with a clear message.
let _resend: Resend | null = null;
function client(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  _resend = new Resend(apiKey);
  return _resend;
}

// Resend's testing sender — works without verifying a domain. Replace
// FROM with your verified `noreply@yourdomain.com` once a domain is set up.
const FROM = process.env.AUTH_EMAIL_FROM ?? 'vibent <onboarding@resend.dev>';

function appUrl(): string {
  // Build the base URL the verification + reset links point at. Falls
  // back to NEXTAUTH_URL which we already set in .env.
  const url = process.env.NEXTAUTH_URL ?? 'http://localhost:5173';
  return url.replace(/\/$/, '');
}

// ---------------------------------------------------------------------------
// Template — a single shared HTML wrapper with vibent's brand colors. Keep
// it inline-styled so it renders correctly across Gmail / Outlook /
// Apple Mail without needing a CSS file.
// ---------------------------------------------------------------------------

type Section = { title: string; body: string; cta: { label: string; href: string }; postscript?: string };

function renderEmail({ title, body, cta, postscript }: Section): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f7;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:32px 36px 8px 36px;">
                <div style="display:inline-block;width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#8B3DFF 0%,#A855F7 60%,#FBBF24 100%);"></div>
                <div style="margin-top:12px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f172a;">vibent</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 36px 0 36px;">
                <h1 style="margin:16px 0 12px 0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">${title}</h1>
                <div style="font-size:15px;line-height:1.6;color:#475569;">${body}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 36px 8px 36px;">
                <a href="${cta.href}" style="display:inline-block;background:#8B3DFF;color:#ffffff;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;text-decoration:none;">${cta.label}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 36px 0 36px;">
                <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">If the button doesn't work, copy and paste this URL into your browser:</p>
                <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;color:#475569;word-break:break-all;"><a href="${cta.href}" style="color:#8B3DFF;text-decoration:none;">${cta.href}</a></p>
              </td>
            </tr>
            ${
              postscript
                ? `<tr><td style="padding:24px 36px 32px 36px;border-top:1px solid #f1f5f9;margin-top:24px;"><p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#94a3b8;">${postscript}</p></td></tr>`
                : `<tr><td style="padding:32px 36px;"></td></tr>`
            }
          </table>
          <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">vibent — meetings that build</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public senders
// ---------------------------------------------------------------------------

export async function sendVerificationEmail(opts: { to: string; rawToken: string }) {
  const url = `${appUrl()}/api/auth/verify-email?token=${encodeURIComponent(opts.rawToken)}`;
  const html = renderEmail({
    title: 'Confirm your email to get started',
    body: 'Welcome to vibent. Click the button below to confirm this is your email address — then you can sign in and start your first room.',
    cta: { label: 'Verify email', href: url },
    postscript: "This link expires in 24 hours. If you didn't sign up for vibent, you can safely ignore this email.",
  });
  await client().emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Confirm your email · vibent',
    html,
  });
}

export async function sendPasswordResetEmail(opts: { to: string; rawToken: string }) {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(opts.rawToken)}`;
  const html = renderEmail({
    title: 'Reset your vibent password',
    body: 'We received a request to reset your password. Click the button below to choose a new one.',
    cta: { label: 'Reset password', href: url },
    postscript: "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.",
  });
  await client().emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Reset your password · vibent',
    html,
  });
}

export async function sendPasswordChangedEmail(opts: { to: string }) {
  const html = renderEmail({
    title: 'Your password was changed',
    body: "Just confirming that your vibent password was changed. If this was you, no action needed. If you don't recognize this change, reset your password immediately and contact support.",
    cta: { label: 'Sign in', href: `${appUrl()}/signin` },
  });
  await client().emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Your password was changed · vibent',
    html,
  });
}
