/*! Nandzz booking embed — https://nandzz.com
 *
 * Inline calendar:
 *   <div data-nandzz-booking="USERNAME"></div>
 * Popup button:
 *   <button data-nandzz-booking-popup="USERNAME">Book now</button>
 * Then, once per page:
 *   <script src="https://nandzz.com/embed.js" async></script>
 *
 * Optional attributes: data-lang="it" (default: the page's <html lang>),
 * data-theme="light|dark".
 * Events: "nandzz:booked" is dispatched on the element (bubbles) when a
 * booking is confirmed, e.g. for conversion tracking.
 */
(function () {
  "use strict";
  if (window.NandzzBooking) {
    window.NandzzBooking.scan();
    return;
  }

  var SOURCE = "nandzz-booking";
  var script = document.currentScript;
  var ORIGIN = "https://nandzz.com";
  try {
    if (script && script.src) ORIGIN = new URL(script.src).origin;
  } catch {}

  var LANGS = ["en", "it", "pt", "es", "fr", "de", "ja"];

  function lang(el) {
    var l = (el.getAttribute("data-lang") || document.documentElement.lang || "").slice(0, 2).toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : "";
  }

  function src(username, el, mode) {
    var q = ["mode=" + mode];
    var l = lang(el);
    if (l) q.push("lang=" + l);
    if (el.getAttribute("data-theme") === "dark") q.push("theme=dark");
    return ORIGIN + "/" + encodeURIComponent(username) + "/booking/embed?" + q.join("&");
  }

  function frame(url, title) {
    var f = document.createElement("iframe");
    f.src = url;
    f.title = title || "Booking";
    f.loading = "lazy";
    f.allow = "clipboard-write";
    f.setAttribute("allowtransparency", "true");
    f.style.cssText = "display:block;width:100%;border:0;background:transparent;color-scheme:normal;";
    return f;
  }

  // iframe window → host element, so messages find their frame.
  var owners = [];
  function ownerOf(win) {
    for (var i = 0; i < owners.length; i++) if (owners[i].frame.contentWindow === win) return owners[i];
    return null;
  }

  function mountInline(el) {
    var username = el.getAttribute("data-nandzz-booking");
    if (!username || el.getAttribute("data-nandzz-mounted")) return;
    el.setAttribute("data-nandzz-mounted", "1");
    var f = frame(src(username, el, "inline"), el.getAttribute("data-title"));
    f.style.height = "560px"; // until the first resize message
    f.style.transition = "height .2s ease";
    el.appendChild(f);
    owners.push({ frame: f, el: el });
  }

  var modal = null;
  function closeModal() {
    if (!modal) return;
    var m = modal;
    modal = null;
    owners = owners.filter(function (o) { return o.frame !== m.frame; });
    document.removeEventListener("keydown", m.onKey);
    document.documentElement.style.overflow = m.overflow;
    m.root.remove();
    if (m.trigger && m.trigger.focus) m.trigger.focus();
  }

  function openModal(trigger) {
    var username = trigger.getAttribute("data-nandzz-booking-popup");
    if (!username) return;
    closeModal();
    var root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;" +
      "padding:16px;background:rgba(15,15,20,.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);";
    var panel = document.createElement("div");
    panel.style.cssText =
      "position:relative;width:100%;max-width:520px;height:min(760px,calc(100vh - 32px));" +
      "border-radius:18px;overflow:hidden;background:" + (trigger.getAttribute("data-theme") === "dark" ? "#141418" : "#fff") +
      ";box-shadow:0 20px 60px rgba(0,0,0,.3);";
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.style.cssText =
      "position:absolute;top:8px;right:8px;z-index:1;width:32px;height:32px;border:0;border-radius:999px;" +
      "background:rgba(0,0,0,.06);color:inherit;font:22px/32px system-ui,sans-serif;cursor:pointer;";
    var f = frame(src(username, trigger, "popup"), trigger.getAttribute("data-title"));
    f.loading = "eager";
    f.style.height = "100%";
    panel.appendChild(f);
    panel.appendChild(close);
    root.appendChild(panel);
    root.addEventListener("click", function (e) { if (e.target === root) closeModal(); });
    close.addEventListener("click", closeModal);
    var onKey = function (e) { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    modal = { root: root, frame: f, trigger: trigger, onKey: onKey, overflow: document.documentElement.style.overflow };
    document.documentElement.style.overflow = "hidden";
    document.body.appendChild(root);
    owners.push({ frame: f, el: trigger });
    close.focus();
  }

  function bindPopup(el) {
    if (el.getAttribute("data-nandzz-mounted")) return;
    el.setAttribute("data-nandzz-mounted", "1");
    el.addEventListener("click", function (e) {
      e.preventDefault();
      openModal(el);
    });
  }

  function scan() {
    var inl = document.querySelectorAll("[data-nandzz-booking]");
    for (var i = 0; i < inl.length; i++) mountInline(inl[i]);
    var pop = document.querySelectorAll("[data-nandzz-booking-popup]");
    for (var j = 0; j < pop.length; j++) bindPopup(pop[j]);
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN || !e.data || e.data.source !== SOURCE) return;
    var o = ownerOf(e.source);
    if (!o) return;
    if (e.data.type === "resize" && typeof e.data.height === "number" && o.frame !== (modal && modal.frame)) {
      o.frame.style.height = Math.max(200, Math.min(e.data.height, 5000)) + "px";
    } else if (e.data.type === "booked") {
      var ev;
      try {
        ev = new CustomEvent("nandzz:booked", { bubbles: true });
      } catch {
        ev = document.createEvent("CustomEvent");
        ev.initCustomEvent("nandzz:booked", true, false, null);
      }
      o.el.dispatchEvent(ev);
    }
  });

  window.NandzzBooking = { scan: scan, open: openModal, close: closeModal };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();
