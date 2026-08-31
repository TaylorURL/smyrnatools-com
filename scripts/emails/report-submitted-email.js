function htmlEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/**
 * Email addressed to the General Managers whose plant sits in the submitter's
 * region; the edge function CCs the district managers assigned to the
 * submitter's plant along with the submitter.
 *
 * @param {Object} options
 * @param {string} options.submitterName - Display name of the person who submitted.
 * @param {string} options.reportTitle - Report type title (e.g. "Lost Load Report").
 * @param {string} [options.weekLabel] - Human-readable week label.
 * @param {string} [options.plantCode] - Submitter's plant code.
 * @param {string} [options.regionName] - Region name for the submitter's plant.
 * @param {Array<{label:string, value:string}>} [options.reportFields] - Report detail
 *   rows to display. Rows missing either a label or a value are dropped.
 * @param {string} [options.frontendUrl] - App URL for the CTA button.
 * @param {Object} [options.theme] - Theme color overrides.
 * @param {string} [options.logoUrl] - Logo image URL.
 * @param {{realTo: string, realCc: string}} [options.debugInfo] - When the send is
 *   being redirected away from its real recipients, the addresses it would have
 *   gone to; rendered as a banner in the body so the diversion is visible.
 * @returns {{subject: string, text: string, html: string}}
 */
export function buildReportSubmittedEmail({
    submitterName,
    reportTitle,
    weekLabel,
    plantCode,
    regionName,
    reportFields,
    frontendUrl,
    theme,
    logoUrl,
    debugInfo
}) {
    const t = {
        pageBg: theme?.pageBg || '#f0f4f8',
        white: theme?.white || '#ffffff',
        bgDark: theme?.bgDark || '#1a202c',
        bgLight: theme?.bgLight || '#f7fafc',
        text: theme?.text || '#2d3748',
        textMuted: theme?.textMuted || '#718096',
        brand: theme?.brand || '#003896',
        border: theme?.border || '#e2e8f0',
        onBrand: theme?.onBrand || '#ffffff',
        debugBg: theme?.debugBg || '#fefce8',
        debugBorder: theme?.debugBorder || '#ca8a04',
        debugTitle: theme?.debugTitle || '#854d0e',
        debugText: theme?.debugText || '#78350f'
    }

    const logo = logoUrl || 'https://smyrnatools.com/static/media/SmyrnaLogo.d7f873f3da1747602db3.png'
    const appUrl = frontendUrl || 'https://smyrnatools.com'
    const year = new Date().getFullYear()
    const name = submitterName || 'A team member'
    const week = weekLabel ? ` for ${weekLabel}` : ''
    const plant = plantCode ? ` (Plant ${plantCode})` : ''
    const region = regionName || 'your region'
    const fields = Array.isArray(reportFields) ? reportFields.filter((f) => f.label && f.value) : []

    const eName = htmlEscape(name)
    const eReportTitle = htmlEscape(reportTitle)
    const eWeek = weekLabel ? ` for ${htmlEscape(weekLabel)}` : ''
    const ePlant = plantCode ? ` (Plant ${htmlEscape(plantCode)})` : ''
    const eRegion = htmlEscape(region)
    const eWeekLabel = weekLabel ? htmlEscape(weekLabel) : ''

    const detailRows = fields
        .map(
            (f) => `
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${t.textMuted};width:130px;vertical-align:top;">${htmlEscape(f.label)}</td>
                      <td style="padding:6px 0;font-size:14px;color:${t.text};font-weight:600;">${htmlEscape(f.value)}</td>
                    </tr>`
        )
        .join('')

    const subject = `${reportTitle} Submitted — ${name}${plant}`
    const text = `${name}${plant} has submitted their ${reportTitle}${week} in the ${region} region.${fields.length ? '\n\nDetails:\n' + fields.map((f) => `${f.label}: ${f.value}`).join('\n') : ''}\n\nView reports at ${appUrl}`
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${eReportTitle} Submitted</title>
</head>
<body style="margin:0;padding:40px 20px;background-color:${t.pageBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table align="center" width="100%" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td>
      <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${t.white};margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07),0 10px 15px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:${t.bgLight};padding:32px 24px;text-align:center;">
            <img src="${logo}" alt="Smyrna Tools" width="180" style="display:block;margin:0 auto;max-width:180px;height:auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;background-color:${t.white};">
            <h1 style="font-size:24px;color:${t.text};margin:0 0 8px;font-weight:700;">Report Submitted</h1>
            <p style="font-size:16px;color:${t.text};line-height:1.6;margin:0 0 24px;">
              ${eName} has submitted their <strong>${eReportTitle}</strong>${eWeek} in the ${eRegion} region.
            </p>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:${t.bgLight};border:1px solid ${t.border};border-radius:8px;margin:0 0 24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${t.textMuted};width:130px;">Report</td>
                      <td style="padding:6px 0;font-size:14px;color:${t.text};font-weight:600;">${eReportTitle}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${t.textMuted};width:130px;">Submitted by</td>
                      <td style="padding:6px 0;font-size:14px;color:${t.text};font-weight:600;">${eName}${ePlant}</td>
                    </tr>
                    ${
                        eWeekLabel
                            ? `<tr>
                      <td style="padding:6px 0;font-size:14px;color:${t.textMuted};width:130px;">Week</td>
                      <td style="padding:6px 0;font-size:14px;color:${t.text};font-weight:600;">${eWeekLabel}</td>
                    </tr>`
                            : ''
                    }
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:${t.textMuted};width:130px;">Region</td>
                      <td style="padding:6px 0;font-size:14px;color:${t.text};font-weight:600;">${eRegion}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${
                fields.length
                    ? `
            <h2 style="font-size:18px;color:${t.text};margin:0 0 12px;font-weight:600;">Report Details</h2>
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:${t.bgLight};border:1px solid ${t.border};border-radius:8px;margin:0 0 24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" border="0" cellpadding="0" cellspacing="0">
                    ${detailRows}
                  </table>
                </td>
              </tr>
            </table>
            `
                    : ''
            }

            <div style="text-align:center;margin:0 0 8px;">
              <a href="${appUrl}" style="display:inline-block;padding:16px 28px;background-color:${t.brand};color:${t.onBrand};text-decoration:none;font-size:15px;font-weight:600;border-radius:8px;">View Reports</a>
            </div>
          </td>
        </tr>
        ${
            debugInfo
                ? `
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:${t.debugBg};border:2px solid ${t.debugBorder};border-radius:8px;">
              <tr>
                <td style="padding:16px 20px;">
                  <div style="font-size:12px;font-weight:700;color:${t.debugTitle};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Debug Enabled</div>
                  <div style="font-size:13px;color:${t.debugText};line-height:1.6;">
                    <strong>Would have sent to:</strong> ${htmlEscape(debugInfo.realTo)}<br/>
                    <strong>Would have CC&#39;d:</strong> ${debugInfo.realCc ? htmlEscape(debugInfo.realCc) : 'none'}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
                : ''
        }
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
