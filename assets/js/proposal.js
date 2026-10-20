// Presentation mode for the course proposal page (_layouts/proposal.liquid).
// Each section.prop-slide becomes a full-screen slide and .prop-detail blocks
// are hidden. Start with P, the Present button, or a #present-N link.
(function () {
  const root = document.documentElement;
  const slides = Array.from(document.querySelectorAll("section.prop-slide"));
  const hud = document.getElementById("propHud");
  if (!slides.length || !hud) return;

  const counter = document.getElementById("propCount");
  const timer = document.getElementById("propTimer");
  const progress = document.getElementById("propProgress");
  const talkSeconds = (Number(hud.dataset.minutes) || 5) * 60;
  let current = 0;
  let startedAt = 0;
  let tick = null;

  const isPresenting = () => root.classList.contains("prop-presenting");
  const clock = (seconds) => Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");

  // Elapsed / target; amber in the last minute, accent once over time
  function updateTimer() {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    timer.textContent = clock(elapsed) + " / " + clock(talkSeconds);
    timer.classList.toggle("is-warning", elapsed >= talkSeconds - 60 && elapsed < talkSeconds);
    timer.classList.toggle("is-over", elapsed >= talkSeconds);
  }

  function resetTimer() {
    startedAt = Date.now();
    updateTimer();
  }

  function show(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => slide.classList.toggle("is-current", i === current));
    slides[current].scrollTop = 0;
    counter.textContent = current + 1 + " / " + slides.length;
    progress.style.width = ((current + 1) / slides.length) * 100 + "%";
    history.replaceState(null, "", "#present-" + (current + 1));
  }

  function start(index) {
    if (!isPresenting()) {
      root.classList.add("prop-presenting");
      hud.hidden = false;
      resetTimer();
      tick = setInterval(updateTimer, 1000);
    }
    show(index);
  }

  function stop() {
    if (!isPresenting()) return;
    root.classList.remove("prop-presenting");
    hud.hidden = true;
    clearInterval(tick);
    slides.forEach((slide) => slide.classList.remove("is-current"));
    history.replaceState(null, "", location.pathname + location.search);
    if (document.fullscreenElement) document.exitFullscreen();
    slides[current].scrollIntoView();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen();
  }

  // Last slide whose top edge is above the upper third of the viewport
  function slideInView() {
    const line = window.innerHeight / 3;
    let found = 0;
    slides.forEach((slide, i) => {
      if (slide.getBoundingClientRect().top <= line) found = i;
    });
    return found;
  }

  function startFromHash() {
    const match = location.hash.match(/^#present(?:-(\d+))?$/);
    if (match) start(match[1] ? Number(match[1]) - 1 : 0);
  }

  const next = () => show(current + 1);
  const prev = () => show(current - 1);
  const keyActions = {
    ArrowRight: next,
    ArrowDown: next,
    PageDown: next,
    " ": next,
    ArrowLeft: prev,
    ArrowUp: prev,
    PageUp: prev,
    Home: () => show(0),
    End: () => show(slides.length - 1),
    Escape: stop,
    f: toggleFullscreen,
    t: resetTimer,
  };

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!isPresenting()) {
      if (key === "p") {
        event.preventDefault();
        start(slideInView());
      }
      return;
    }
    const action = keyActions[key];
    if (action) {
      event.preventDefault();
      action();
    }
  });

  const buttonActions = { prev, next, timer: resetTimer, fullscreen: toggleFullscreen, exit: stop };
  hud.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prop]");
    if (!button) return;
    buttonActions[button.dataset.prop]();
    button.blur();
  });

  // Swipe between slides on touch screens
  let touchX = null;
  document.addEventListener(
    "touchstart",
    (event) => {
      touchX = event.touches[0].clientX;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    (event) => {
      if (!isPresenting() || touchX === null) return;
      const dx = event.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 60) show(current + (dx < 0 ? 1 : -1));
      touchX = null;
    },
    { passive: true }
  );

  window.addEventListener("hashchange", startFromHash);
  startFromHash();
})();
