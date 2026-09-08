/** /yt?v=<id> — the YouTube player, served from this site.
 *
 * YouTube refuses to play inside an app-origin page (error 153: no web
 * referer), so the app embeds THIS page, which is a real website as far as
 * YouTube is concerned, and this page hosts the player. Commands come in
 * from the app over postMessage (play, pause, load, seek); state and
 * progress go back out the same way. Nothing here is hidden or altered:
 * it is YouTube's own player, visible, as their terms require. */
export function ytHtml(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>Player</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{position:absolute;inset:0}</style>
</head><body><div id="p"></div>
<script>
  var q = new URLSearchParams(location.search), first = q.get("v") || "", player = null, ready = false, queued = null, timer = null;
  function post(m) { try { parent.postMessage(Object.assign({ sg: "yt" }, m), "*"); } catch (e) {} }
  function tick() { if (!player || !player.getDuration) return; try { post({ type: "time", t: player.getCurrentTime(), d: player.getDuration() }); } catch (e) {} }
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player("p", {
      videoId: first, playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, controls: 1 },
      events: {
        onReady: function () { ready = true; post({ type: "ready" }); if (queued) { player.loadVideoById(queued); queued = null; } timer = setInterval(tick, 1000); },
        onStateChange: function (e) { post({ type: "state", state: e.data }); },
        onError: function (e) { post({ type: "error", code: e.data }); }
      }
    });
  };
  window.addEventListener("message", function (ev) {
    var m = ev.data || {};
    if (m.sg !== "cmd") return;
    if (m.func === "load") { if (ready) player.loadVideoById(m.id); else queued = m.id; return; }
    if (!ready) return;
    if (m.func === "play") player.playVideo();
    else if (m.func === "pause") player.pauseVideo();
    else if (m.func === "seek") player.seekTo(m.t || 0, true);
  });
  var s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
</script></body></html>`;
}
