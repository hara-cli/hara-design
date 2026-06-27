// hara-design live-reload client (injected before </body>). Reconnecting SSE → full reload on change.
(function () {
  function connect() {
    var es = new EventSource("/__reload");
    es.addEventListener("reload", function () { location.reload(); });
    es.onerror = function () { es.close(); setTimeout(connect, 1000); };
  }
  connect();
})();
