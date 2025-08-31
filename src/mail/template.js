// mail/templates/shipmentUpdate.js
export function buildShipmentUpdateEmail({
  brand = {
    name: "GlobalEdge",
    color: "#E11D48",               // your red
    logoUrl: "https://yourcdn.com/globaledge-logo.png",
    supportEmail: "support@shipglobaledge.com",
    address: "GlobalEdge Logistics, 21 Wharf Rd, London, UK",
  },
  user = { firstName: "London", email: "user@example.com" },
  tracking = {
    id: "GEMEX2TC95N4RN",
    status: "IN_TRANSIT",           // CREATED | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | EXCEPTION
    origin: "Brussels, Belgium",
    destination: "London, United Kingdom",
    lastUpdate: "2025-08-30 12:20",
    eta: "Aug 31, 2025",
    url: "https://shipglobaledge.com/track/GEMEX2TC95N4RN"
  },
  preheader = "Shipment update and live tracking inside."
}) {
  const pctByStatus = {
    CREATED: 15, IN_TRANSIT: 55, OUT_FOR_DELIVERY: 85,
    DELIVERED: 100, EXCEPTION: 55
  }[tracking.status] ?? 40;

  const subject = `Update on ${tracking.id} • ${tracking.status.replace(/_/g, " ")}`;
  const text = [
    `Hello ${user.firstName},`,
    `Update on shipment ${tracking.id}.`,
    `Status: ${tracking.status.replace(/_/g, " ")}`,
    `Route: ${tracking.origin} -> ${tracking.destination}`,
    tracking.eta ? `ETA: ${tracking.eta}` : null,
    `Track: ${tracking.url}`,
    `Regards, ${brand.name}`
  ].filter(Boolean).join("\n");

  const html = `
  <!doctype html><html lang="en"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <meta name="x-preheader" content="${preheader}">
    <title>${subject}</title>
    <style>
      /* Dark-mode safety */
      @media (prefers-color-scheme: dark) {
        .bg { background:#0b0b0c !important; }
        .card { background:#151517 !important; color:#e6e6e6 !important; }
        .muted { color:#b3b3b3 !important; }
        .divider { border-color:#2a2a2c !important; }
      }
      a { text-decoration:none; }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#f3f4f6;" class="bg">
    <!-- preheader (hidden in most clients) -->
    <div style="display:none;overflow:hidden;line-height:1px;opacity:0;height:0;width:0;max-height:0;max-width:0;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;" class="bg">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px; max-width:100%;">
            <!-- Header -->
            <tr>
              <td style="padding:16px 20px; background:#ffffff; border-radius:12px 12px 0 0;" class="card">
                <table role="presentation" width="100%">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${brand.logoUrl}" alt="${brand.name}" height="28" style="display:block; border:0;">
                    </td>
                    <td align="right" style="font:600 14px system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#111827;">
                      ${brand.name} Courier
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="background:#ffffff; padding:8px 20px 20px; border-radius:0 0 12px 12px;" class="card">
                <h1 style="margin:10px 0 8px; font:700 20px system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#111827;">
                  Update on <span style="letter-spacing:0.3px;">${tracking.id}</span>
                </h1>

                <!-- Status badge -->
                <div style="display:inline-block; padding:6px 10px; border-radius:999px; font:600 12px system-ui,-apple-system,Segoe UI,Roboto,Arial; background:${brand.color}1A; color:${brand.color}; margin:6px 0 14px;">
                  ${tracking.status.replace(/_/g, " ")}
                </div>

                <!-- Route -->
                <p style="margin:0 0 14px; font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#374151;">
                  ${tracking.origin} &nbsp;→&nbsp; ${tracking.destination}
                  ${tracking.eta ? ` • <span class="muted" style="color:#6b7280;">ETA ${tracking.eta}</span>` : ""}
                </p>

                <!-- Progress bar -->
                <div style="height:10px; background:#E5E7EB; border-radius:999px; overflow:hidden; margin:14px 0 18px;">
                  <div style="height:10px; width:${pctByStatus}%; background:${brand.color};"></div>
                </div>

                <!-- Key info cards -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
                  <tr>
                    <td style="width:50%; padding:10px; background:#F9FAFB; border-radius:10px;">
                      <div style="font:700 12px system-ui; color:#6b7280; text-transform:uppercase; letter-spacing:.4px;">Shipment</div>
                      <div style="font:600 14px system-ui; color:#111827; margin-top:4px;">${tracking.id}</div>
                    </td>
                    <td style="width:50%; padding:10px; background:#F9FAFB; border-radius:10px;">
                      <div style="font:700 12px system-ui; color:#6b7280; text-transform:uppercase; letter-spacing:.4px;">Last Update</div>
                      <div style="font:600 14px system-ui; color:#111827; margin-top:4px;">${tracking.lastUpdate}</div>
                    </td>
                  </tr>
                </table>

                <!-- CTA -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;">
                  <tr>
                    <td>
                      <a href="${tracking.url}"
                         style="display:inline-block; padding:12px 18px; border-radius:10px; background:${brand.color}; color:#ffffff; font:600 14px system-ui,-apple-system,Segoe UI,Roboto,Arial;">
                        Track shipment
                      </a>
                    </td>
                    <td width="12"></td>
                    <td>
                      <a href="${brand.supportEmail ? `mailto:${brand.supportEmail}` : '#'}"
                         style="display:inline-block; padding:12px 18px; border-radius:10px; background:#111827; color:#ffffff; font:600 14px system-ui,-apple-system,Segoe UI,Roboto,Arial;">
                        Contact support
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:16px 0 0; font:14px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#6b7280;">
                  If you weren’t expecting this update, please ignore this email or contact support.
                </p>

                <!-- Divider -->
                <hr class="divider" style="border:none; border-top:1px solid #E5E7EB; margin:20px 0;">

                <!-- Footer -->
                <p style="margin:0; font:12px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial; color:#9CA3AF;">
                  Sent by ${brand.name} • <a href="mailto:${brand.supportEmail}" style="color:${brand.color};">${brand.supportEmail}</a><br/>
                  ${brand.address}
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body></html>`.trim();

  return { subject, html, text };
}
