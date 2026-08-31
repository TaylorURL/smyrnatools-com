/**
 * Reference template for the builder pattern every file in this directory
 * follows: one exported function taking a single data object and returning
 * `{ subject, text, html }`, with no I/O of its own. The Supabase edge
 * functions import a builder, call it, and hand the result to MailerSend.
 *
 * Callers supply the shared presentation context alongside the template's
 * own fields:
 *   - theme:       { pageBg, white, bgDark, bgLight, text, textMuted, brand, border, onBrand }
 *   - logoUrl:     URL to the company logo
 *   - frontendUrl: base URL of the frontend app
 *
 * Every one of those is optional; each has a hard-coded fallback below so a
 * builder still renders when the environment supplies nothing.
 */
export function buildExampleNotificationEmail({ recipientName, message, theme, logoUrl, frontendUrl }) {
    const t = {
        pageBg: theme?.pageBg || '#f0f4f8',
        white: theme?.white || '#ffffff',
        bgDark: theme?.bgDark || '#1a202c',
        bgLight: theme?.bgLight || '#f7fafc',
        text: theme?.text || '#2d3748',
        textMuted: theme?.textMuted || '#718096',
        brand: theme?.brand || '#003896',
        border: theme?.border || '#e2e8f0',
        onBrand: theme?.onBrand || '#ffffff'
    }

    const name = recipientName || 'there'
    const body = message || 'You have a new notification.'
    const logo = logoUrl || 'https://smyrnatools.com/static/media/SmyrnaLogo.d7f873f3da1747602db3.png'
    const appUrl = frontendUrl || 'https://smyrnatools.com'
    const year = new Date().getFullYear()

    const subject = `Smyrna Tools - Notification`
    const text = `Hi ${name},\n\n${body}\n\nVisit ${appUrl} to view details.`
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification</title>
</head>
<body style="margin:0;padding:40px 20px;background-color:${t.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td>
      <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${t.white};margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07),0 10px 15px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:${t.bgDark};padding:32px 24px;text-align:center;">
            <img src="${logo}" alt="Smyrna Tools" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;background-color:${t.white};">
            <h1 style="font-size:28px;color:${t.text};margin:0 0 12px;font-weight:700;">Notification</h1>
            <p style="font-size:18px;color:${t.text};margin:0 0 24px;font-weight:500;">Hi ${name},</p>
            <p style="font-size:16px;color:${t.text};line-height:1.6;margin:0 0 20px;">${body}</p>
            <div style="margin:32px 0;text-align:center;">
              <a href="${appUrl}" style="display:inline-block;padding:16px 32px;background-color:${t.brand};color:${t.onBrand};text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;">View in Smyrna Tools</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color:${t.bgLight};padding:24px 32px;text-align:center;">
            <p style="color:${t.textMuted};font-size:13px;line-height:1.6;margin:0;">
              &copy; ${year} Smyrna Tools. All rights reserved.<br />
              Built for SRM Concrete | <a href="https://smyrnatools.com" style="color:${t.brand};text-decoration:none;font-weight:500;">smyrnatools.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

    return { subject, text, html }
}
