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
      { value: "", label: "Select a trade…" },
      { value: "electrical-contracting", label: "Electrical" },
      { value: "plumbing", label: "Plumbing" },
      { value: "mobile-mechanics", label: "Mobile Mechanics" },
      { value: "refrigeration", label: "Refrigeration" },
      { value: "appliance-repair", label: "Appliance Repair" },
    ];

    // ── Styles ──
    var style = document.createElement("style");
    style.textContent =
      ".ff-widget{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;box-sizing:border-box}" +
      ".ff-widget *{box-sizing:border-box}" +
      ".ff-widget h3{margin:0 0 4px;font-size:20px;font-weight:600;color:#1a202c}" +
      ".ff-widget p.ff-sub{margin:0 0 20px;font-size:14px;color:#718096}" +
      ".ff-widget label{display:block;font-size:13px;font-weight:500;color:#4a5568;margin-bottom:4px}" +
      ".ff-widget input,.ff-widget select,.ff-widget textarea{width:100%;padding:10px 12px;border:1px solid #cbd5e0;border-radius:8px;font-size:14px;color:#1a202c;margin-bottom:14px;outline:none;transition:border .15s}" +
      ".ff-widget input:focus,.ff-widget select:focus,.ff-widget textarea:focus{border-color:#3182ce;box-shadow:0 0 0 3px rgba(49,130,206,.15)}" +
      ".ff-widget textarea{resize:vertical;min-height:80px}" +
      ".ff-widget button{width:100%;padding:12px;border:none;border-radius:8px;background:#3182ce;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:background .15s}" +
      ".ff-widget button:hover{background:#2b6cb0}" +
      ".ff-widget button:disabled{opacity:.6;cursor:not-allowed}" +
      ".ff-widget .ff-error{color:#e53e3e;font-size:13px;margin-bottom:12px}" +
      ".ff-widget .ff-success{text-align:center;padding:32px 0}" +
      ".ff-widget .ff-success h3{color:#38a169;margin-bottom:8px}" +
      ".ff-widget .ff-success p{color:#4a5568;font-size:14px;margin:0}" +
      ".ff-widget .ff-row{display:flex;gap:12px}" +
      ".ff-widget .ff-row>div{flex:1}";
    target.appendChild(style);

    // ── Form HTML ──
    var container = document.createElement("div");
    container.className = "ff-widget";

    var tradeOptions = trades
      .map(function (t) {
        return '<option value="' + t.value + '">' + t.label + "</option>";
      })
      .join("");

    container.innerHTML =
      "<h3>Request a Quote</h3>" +
      '<p class="ff-sub">Fill in the details below and we\'ll get back to you shortly.</p>' +
      '<form id="ff-quote-form">' +
      "<label>Full Name *</label>" +
      '<input type="text" name="name" required maxlength="200" placeholder="John Doe">' +
      '<div class="ff-row">' +
      "<div><label>Email *</label>" +
      '<input type="email" name="email" required maxlength="255" placeholder="john@email.com"></div>' +
      "<div><label>Phone</label>" +
      '<input type="tel" name="phone" maxlength="30" placeholder="+27..."></div></div>' +
      "<label>Trade / Service</label>" +
      '<select name="trade">' +
      tradeOptions +
      "</select>" +
      "<label>Address</label>" +
      '<input type="text" name="address" maxlength="500" placeholder="10 Melba Street, Cape Town">' +
      "<label>Message</label>" +
      '<textarea name="message" maxlength="2000" placeholder="Describe what you need…"></textarea>' +
      '<div class="ff-error" id="ff-error" style="display:none"></div>' +
      "<button type=\"submit\">Send Quote Request</button>" +
      "</form>";

    target.appendChild(container);

    // ── Submit handler ──
    var form = container.querySelector("#ff-quote-form");
    var errorEl = container.querySelector("#ff-error");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Sending…";
      errorEl.style.display = "none";

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
              "<h3>✓ Quote Request Sent!</h3>" +
              "<p>We've received your request and will be in touch soon.</p>" +
              "</div>";
          } else {
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
