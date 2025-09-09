// src/controllers/admin/shipments.controller.js
import Shipment from "../../models/Shipment.js";
import { sendMail } from "../../config/mailer.js";
import { buildShipmentUpdateEmail } from "../../mail/template.js";

/* ---------- Status helpers ---------- */
const STATUS_CODES = [
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
  "CANCELLED",
];

const LABEL_TO_CODE = {
  "CREATED": "CREATED",
  "PICKED UP": "PICKED_UP",
  "IN TRANSIT": "IN_TRANSIT",
  "OUT FOR DELIVERY": "OUT_FOR_DELIVERY",
  "DELIVERED": "DELIVERED",
  "EXCEPTION": "EXCEPTION",
  "CANCELLED": "CANCELLED",
};

function normalizeStatus(input) {
  if (!input) return null;
  const raw = String(input).trim();
  const up = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (STATUS_CODES.includes(up)) return up;
  const lbl = raw.toUpperCase().replace(/[\s_]+/g, " ");
  return LABEL_TO_CODE[lbl] || null;
}

function statusLabel(code) {
  switch (code) {
    case "PICKED_UP": return "Picked Up";
    case "IN_TRANSIT": return "In Transit";
    case "OUT_FOR_DELIVERY": return "Out for Delivery";
    case "DELIVERED": return "Delivered";
    case "EXCEPTION": return "Exception";
    case "CANCELLED": return "Cancelled";
    case "CREATED":
    default: return "Created";
  }
}

/* ---------- helpers: map admin body -> template.adminMessage ---------- */
function extractAdminMessage(body = {}) {
  // accept simple fields or the nested object
  const nested = body.adminMessage || {};
  const text = body.message ?? body.note ?? nested.text;
  const html = body.messageHtml ?? nested.html;
  const markdown = body.messageMarkdown ?? nested.markdown;
  const title = body.messageTitle ?? nested.title ?? "Note from Operations";
  const placement = (body.messagePlacement ?? nested.placement ?? "after_progress");

  if (!text && !html && !markdown) return null;
  return { text, html, markdown, title, placement };
}

/* ---------- LIST: GET /api/admin/shipments ---------- */
export const listAllShipments = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const flat  = String(req.query.flat || "").toLowerCase() === "1";
    const pagingRequested = "page" in req.query || "limit" in req.query;

    const where = {};
    const { status, q } = req.query;

    if (status && status !== "all") {
      const code = normalizeStatus(status);
      if (code) {
        where.status = code;
      } else {
        where.$or = [
          { status },
          { status: status.toUpperCase() },
          { status: status.replace(/[\s-]+/g, "_").toUpperCase() },
        ];
      }
    }

    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), "i");
      where.$or = (where.$or || []).concat([
        { trackingNumber: rx },
        { from: rx },
        { to: rx },
        { recipientEmail: rx },
        { lastLocation: rx },
      ]);
    }

    const [items, total] = await Promise.all([
      Shipment.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Shipment.countDocuments(where),
    ]);

    if (flat || !pagingRequested) return res.json(items);
    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error("❌ listAllShipments error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ---------- GET ONE: /api/admin/shipments/:id ---------- */
export const getShipmentById = async (req, res) => {
  try {
    const s = await Shipment.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Shipment not found" });
    return res.json(s);
  } catch (err) {
    console.error("❌ getShipmentById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ---------- PATCH: /api/admin/shipments/:id ---------- */
/**
 * body: {
 *   status, lastLocation, note, eta, etaAt, from|origin, to|destination,
 *   // NEW (any of these):
 *   message, messageHtml, messageMarkdown,
 *   messageTitle, messagePlacement,
 *   adminMessage: { html|markdown|text, title, placement },
 *   notifyNow: boolean // force send even if EMAIL_AUTO_NOTIFY !== "1"
 * }
 */
export const updateShipment = async (req, res) => {
  try {
    const {
      status,
      lastLocation,
      note,
      eta,
      etaAt,
      from,
      to,
      origin,
      destination,
      notifyNow,
    } = req.body || {};

    const s = await Shipment.findById(req.params.id);
    if (!s) return res.status(404).json({ message: "Shipment not found" });

    // normalize status
    if (status) {
      const code = normalizeStatus(status);
      if (!code) {
        return res.status(400).json({ message: `Invalid status: ${status}` });
      }
      s.status = code;
    }

    // allow clearing with empty string
    if (lastLocation !== undefined) s.lastLocation = String(lastLocation).trim();
    if (eta !== undefined) s.eta = String(eta);

    if (etaAt !== undefined) {
      const dt = new Date(etaAt);
      if (isNaN(dt.getTime())) {
        return res.status(400).json({ message: "Invalid etaAt datetime" });
      }
      s.etaAt = dt;
    }

    // ----- ORIGIN / DESTINATION -----
    const nextFrom = from !== undefined ? from : origin;
    const nextTo   = to   !== undefined ? to   : destination;

    const changes = [];

    if (nextFrom !== undefined) {
      const prev = s.from || "";
      s.from = String(nextFrom).trim();
      if (s.from !== prev) changes.push(`Origin: "${prev}" → "${s.from}"`);
    }
    if (nextTo !== undefined) {
      const prev = s.to || "";
      s.to = String(nextTo).trim();
      if (s.to !== prev) changes.push(`Destination: "${prev}" → "${s.to}"`);
    }

    // timeline entry
    s.timeline.push({
      status: s.status || "CREATED",
      at: new Date(),
      note:
        note
          || (lastLocation ? `Location: ${lastLocation}` :
              (changes.length ? changes.join(" | ") : "Updated by admin")),
    });

    await s.save();

    // ----- OPTIONAL: Notify recipient (auto or forced) -----
    const shouldNotify = (process.env.EMAIL_AUTO_NOTIFY === "1") || !!notifyNow;
    const adminMsg = extractAdminMessage(req.body); // <— NEW

    if (shouldNotify && s.recipientEmail) {
      try {
        const brand = {
          name: process.env.BRAND_NAME || "GlobalEdge",
          color: process.env.BRAND_COLOR || "#E11D48",
          logoUrl: process.env.BRAND_LOGO_URL || "",
          supportEmail: process.env.SUPPORT_EMAIL || "support@shipglobaledge.com",
          address: process.env.BRAND_ADDRESS || "GlobalEdge Logistics",
        };

        const { subject, html, text } = buildShipmentUpdateEmail({
          user: { firstName: s.recipientName?.split(" ")[0] || "Customer", email: s.recipientEmail },
          tracking: {
            id: s.trackingNumber || String(s._id),
            status: s.status,
            origin: s.from,
            destination: s.to,
            lastUpdate: new Date().toLocaleString(),
            eta: s.eta || (s.etaAt ? new Date(s.etaAt).toLocaleString() : ""),
            url: `${process.env.APP_URL || ""}/track/${s.trackingNumber || String(s._id)}`
          },
          brand,
          adminMessage: adminMsg || undefined, // <— inject edited body
          preheader: adminMsg?.text || adminMsg?.markdown || (adminMsg?.html ? "Admin note included." : "Shipment update and live tracking inside.")
        });

        await sendMail({
          to: s.recipientEmail,
          subject,
          html,
          text,
          reply_to: brand.supportEmail
        });
      } catch (e) {
        console.error("ℹ️ Auto-notify failed:", e?.message || e);
        // Do not fail the admin update if email fails
      }
    }

    return res.json({ message: "Shipment updated", shipment: s, notified: shouldNotify && !!s.recipientEmail });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error("❌ updateShipment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/* ---------- POST NOTIFY: /api/admin/shipments/:id/notify ---------- */
/**
 * body may include:
 *  - subject (override)
 *  - to (override recipient)
 *  - message | messageHtml | messageMarkdown
 *  - messageTitle | messagePlacement
 *  - adminMessage: { html|markdown|text, title, placement }
 */
export const notifyRecipient = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, to } = req.body || {};

    const s = await Shipment.findById(id).lean();
    if (!s) return res.status(404).json({ message: "Shipment not found" });

    const recipient =
      (to && String(to).trim()) ||
      (s.recipientEmail && String(s.recipientEmail).trim());

    if (!recipient) {
      return res.status(400).json({
        message:
          "No recipient email on shipment. Provide `to` in body or set `recipientEmail` on the shipment.",
      });
    }

    const brand = {
      name: process.env.BRAND_NAME || "GlobalEdge",
      color: process.env.BRAND_COLOR || "#E11D48",
      logoUrl: process.env.BRAND_LOGO_URL || "",
      supportEmail: process.env.SUPPORT_EMAIL || "support@shipglobaledge.com",
      address: process.env.BRAND_ADDRESS || "GlobalEdge Logistics, 21 Wharf Rd, London, UK",
    };

    const adminMsg = extractAdminMessage(req.body); // <— NEW

    const { subject: templSubject, html, text } = buildShipmentUpdateEmail({
      user: { firstName: s.recipientName?.split(" ")[0] || "Customer", email: recipient },
      tracking: {
        id: s.trackingNumber || id,
        status: s.status,
        origin: s.from,
        destination: s.to,
        lastUpdate: new Date().toLocaleString(),
        eta: s.eta || (s.etaAt ? new Date(s.etaAt).toLocaleString() : ""),
        url: `${process.env.APP_URL || ""}/track/${s.trackingNumber || id}`
      },
      brand,
      adminMessage: adminMsg || undefined,
      preheader: adminMsg?.text || adminMsg?.markdown || (adminMsg?.html ? "Admin note included." : "Shipment update and live tracking inside."),
    });

    await sendMail({
      to: recipient,
      subject: subject || templSubject,
      html,
      text,
      reply_to: brand.supportEmail
    });

    return res.json({ message: "Notification sent", to: recipient });
  } catch (err) {
    console.error("notifyRecipient error:", err);
    return res.status(500).json({ message: "Failed to send notification" });
  }
};
