/**
 * FieldFlow Quote Request Widget
 *
 * Embed on any website:
 *   <div id="fieldflow-quote"></div>
 *   <script
 *     src="https://fieldflow-billing.lovable.app/widgets/quote.js"
 *     data-company="cmp_xxx"
 *     data-mount="#fieldflow-quote">
 *   </script>
 */
(function () {
  "use strict";

  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  var companyKey = script.getAttribute("data-company") || "";
  var mountSelector = script.getAttribute("data-mount") || "#fieldflow-quote";
  var API_URL =
    "https://cchhfgdowqlspxujfbrb.supabase.co/functions/v1/create-quote-request";

  function mount() {
    var target = document.querySelector(mountSelector);
    if (!target) {
      console.error("[FieldFlow] Mount target not found:", mountSelector);
      return;
    }

    var trades = [
      { value: "", label: "Select a trade..." },
      { value: "electrical-contracting", label: "Electrical" },
      { value: "plumbing", label: "Plumbing" },
      { value: "mobile-mechanics", label: "Mobile Mechanics" },
      { value: "refrigeration", label: "Refrigeration" },
      { value: "appliance-repair", label: "Appliance Repair" },
    ];

    // -- Styles --
    var style = document.createElement("style");
    style.textContent =
      ".ff-widget{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;background:linear-gradient(180deg,#ffffff,#fbfdff);box-shadow:0 12px 30px rgba(15,23,42,.08);overflow:hidden;box-sizing:border-box}" +
      ".ff-widget *{box-sizing:border-box}" +
      ".ff-header{padding:22px 24px 0}" +
      ".ff-title{margin:0;font-size:22px;font-weight:750;letter-spacing:-.02em;line-height:1.2;color:#0f172a}" +
      ".ff-sub{margin:8px 0 0;font-size:14px;line-height:1.45;color:#475569}" +
      ".ff-body{padding:18px 24px 24px}" +
      ".ff-field{margin-top:14px}" +
      ".ff-label{display:flex;align-items:baseline;gap:6px;margin:0 0 6px;font-size:13px;font-weight:650;color:#334155}" +
      ".ff-req{color:#dc2626}" +
      ".ff-input,.ff-select,.ff-textarea{width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;line-height:1.2;color:#0f172a;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s}" +
      ".ff-input::placeholder,.ff-textarea::placeholder{color:#94a3b8}" +
      ".ff-input:focus,.ff-select:focus,.ff-textarea:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.14)}" +
      ".ff-select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,#64748b 50%),linear-gradient(135deg,#64748b 50%,transparent 50%);background-position:calc(100% - 18px) calc(1em + 2px),calc(100% - 13px) calc(1em + 2px);background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:36px}" +
      ".ff-textarea{resize:vertical;min-height:96px;line-height:1.4}" +
      ".ff-row{display:flex;gap:12px}" +
      ".ff-row>div{flex:1;min-width:0}" +
      "@media (max-width:420px){.ff-header{padding:20px 18px 0}.ff-body{padding:16px 18px 20px}.ff-row{flex-direction:column;gap:0}}" +
      ".ff-error{display:none;margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-size:13px;line-height:1.35}" +
      ".ff-note{margin-top:12px;font-size:12px;line-height:1.35;color:#64748b}" +
      ".ff-btn{width:100%;margin-top:14px;padding:12px 14px;border:none;border-radius:12px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:15px;font-weight:750;letter-spacing:.01em;cursor:pointer;box-shadow:0 10px 22px rgba(37,99,235,.22);transition:transform .08s,filter .15s,box-shadow .15s}" +
      ".ff-btn:hover{filter:brightness(1.03);box-shadow:0 12px 26px rgba(37,99,235,.28)}" +
      ".ff-btn:active{transform:translateY(1px)}" +
      ".ff-btn:disabled{opacity:.7;cursor:not-allowed;box-shadow:none}" +
      ".ff-success{text-align:center;padding:30px 24px}" +
      ".ff-check{width:44px;height:44px;border-radius:999px;background:#dcfce7;color:#16a34a;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;margin:0 auto 10px}" +
      ".ff-success-title{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em;color:#0f172a}" +
      ".ff-success-sub{margin:8px 0 0;font-size:14px;line-height:1.45;color:#475569}";
    target.appendChild(style);

    // -- Form HTML --
    var container = document.createElement("div");
    container.className = "ff-widget";

    var tradeOptions = trades
      .map(function (t) {
        return '<option value="' + t.value + '">' + t.label + "</option>";
      })
      .join("");

    container.innerHTML =
      '<div class="ff-header">' +
      '<h3 class="ff-title">Request a Quote</h3>' +
      '<p class="ff-sub">Fill in the details below and we\'ll get back to you shortly.</p>' +
      "</div>" +
      '<div class="ff-body">' +
      '<form id="ff-quote-form" class="ff-form" novalidate>' +
      '<div class="ff-field">' +
      '<label class="ff-label" for="ff-name">Full Name <span class="ff-req">*</span></label>' +
      '<input id="ff-name" class="ff-input" type="text" name="name" required maxlength="200" placeholder="John Doe" autocomplete="name">' +
      "</div>" +
      '<div class="ff-row">' +
      '<div class="ff-field">' +
      '<label class="ff-label" for="ff-email">Email <span class="ff-req">*</span></label>' +
      '<input id="ff-email" class="ff-input" type="email" name="email" required maxlength="255" placeholder="john@email.com" autocomplete="email">' +
      "</div>" +
      '<div class="ff-field">' +
      '<label class="ff-label" for="ff-phone">Phone</label>' +
      '<input id="ff-phone" class="ff-input" type="tel" name="phone" maxlength="30" placeholder="+27..." autocomplete="tel">' +
      "</div>" +
      "</div>" +
      '<div class="ff-field">' +
      '<label class="ff-label" for="ff-trade">Trade / Service</label>' +
      '<select id="ff-trade" class="ff-select" name="trade">' +
      tradeOptions +
      "</select>" +
      "</div>" +
      '<div class="ff-field">' +
      '<label class="ff-label" for="ff-address">Address</label>' +
      '<input id="ff-address" class="ff-input" type="text" name="address" maxlength="500" placeholder="10 Melba Street, Cape Town" autocomplete="street-address">' +
      "</div>" +
      '<div class="ff-field">' +
      '<label class="ff-label" for="ff-message">Message</label>' +
      '<textarea id="ff-message" class="ff-textarea" name="message" maxlength="2000" placeholder="Describe what you need..."></textarea>' +
      "</div>" +
      '<div class="ff-error" id="ff-error"></div>' +
      '<button class="ff-btn" type="submit">Send Quote Request</button>' +
      '<div class="ff-note">By submitting, you agree that we can contact you about this request.</div>' +
      "</form>" +
      "</div>";

    target.appendChild(container);

    // -- Submit handler --
    var form = container.querySelector("#ff-quote-form");
    var errorEl = container.querySelector("#ff-error");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Sending...";
      errorEl.style.display = "none";
      errorEl.textContent = "";

      var fd = new FormData(form);
      var payload = {
        company_public_key: companyKey,
        name: (fd.get("name") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        phone: (fd.get("phone") || "").toString().trim() || null,
        trade: (fd.get("trade") || "").toString().trim() || null,
        address: (fd.get("address") || "").toString().trim() || null,
        message: (fd.get("message") || "").toString().trim() || null,
      };

      fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { status: res.status, data: data };
          });
        })
        .then(function (result) {
          if (result.status >= 200 && result.status < 300) {
            container.innerHTML =
              '<div class="ff-success">' +
              '<div class="ff-check" aria-hidden="true">&#10003;</div>' +
              '<h3 class="ff-success-title">Quote Request Sent</h3>' +
              "<p class=\"ff-success-sub\">We've received your request and will be in touch soon.</p>" +
              "</div>";
          } else {
            if (result.status === 403) {
              throw new Error("This business is not currently accepting quote requests.");
            }
            throw new Error(result.data.error || "Something went wrong");
          }
        })
        .catch(function (err) {
          errorEl.textContent = err.message || "Network error. Please try again.";
          errorEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = "Send Quote Request";
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
