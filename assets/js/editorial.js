// Navigation behaviour and scroll-reveal animations for the editorial theme.
(function () {
  const navbar = document.getElementById("navbar");
  const navToggle = document.getElementById("navToggle");
  const mobileNav = document.getElementById("mobileNav");

  // On the one-page home, the navbar slides in once the hero is scrolled past.
  if (navbar && navbar.classList.contains("ed-nav--autohide")) {
    const updateNav = () => navbar.classList.toggle("visible", window.scrollY > 300 || mobileNav.classList.contains("open"));
    window.addEventListener("scroll", updateNav, { passive: true });
    updateNav();
  }

  // Mobile menu
  if (navToggle && mobileNav) {
    const setOpen = (open) => {
      navToggle.classList.toggle("active", open);
      mobileNav.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", String(open));
    };
    navToggle.addEventListener("click", () => setOpen(!mobileNav.classList.contains("open")));
    mobileNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileNav.classList.contains("open")) {
        setOpen(false);
        navToggle.focus();
      }
    });
  }

  // Highlight the nav link of the section currently in view
  const sections = document.querySelectorAll("section.ed-section[id]");
  const navLinks = document.querySelectorAll(".ed-nav-links a[data-section]");
  if (sections.length && navLinks.length) {
    const updateActive = () => {
      let current = "";
      sections.forEach((section) => {
        if (window.scrollY >= section.offsetTop - 120) current = section.id;
      });
      navLinks.forEach((link) => link.classList.toggle("active", link.dataset.section === current));
    };
    window.addEventListener("scroll", updateActive, { passive: true });
    updateActive();
  }

  // Fade sections in as they scroll into view
  const revealItems = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );
  revealItems.forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.classList.add("visible");
    } else {
      observer.observe(el);
    }
  });
})();
