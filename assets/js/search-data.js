// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "About",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-publications",
          title: "Publications",
          description: "Papers and preprints, newest first.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/publications/";
          },
        },{id: "nav-repositories",
          title: "Repositories",
          description: "Code from my research and projects.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/repositories/";
          },
        },{id: "nav-cv",
          title: "CV",
          description: "Education, research, industry experience, and publications. Download the full CV or the one-page resume below.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/cv/";
          },
        },{id: "news-graduated-from-bilkent-university-with-a-b-sc-in-electrical-and-electronics-engineering-and-received-the-department-s-academic-excellence-and-research-excellence-awards-mortar-board",
          title: 'Graduated from Bilkent University with a B.Sc. in Electrical and Electronics Engineering, and...',
          description: "",
          section: "News",},{id: "news-started-my-ph-d-in-electrical-and-computer-engineering-at-the-university-of-maryland-college-park-advised-by-prof-sennur-ulukus",
          title: 'Started my Ph.D. in Electrical and Computer Engineering at the University of Maryland,...',
          description: "",
          section: "News",},{id: "news-new-preprint-on-the-diverse-dynamical-behaviors-arising-in-deep-linear-transformers-which-shows-that-in-two-dimensions-stacked-linear-self-attention-reduces-exactly-to-a-generalized-kuramoto-model-under-review-at-foundations-of-computational-mathematics",
          title: 'New preprint: On the Diverse Dynamical Behaviors Arising in Deep Linear Transformers, which...',
          description: "",
          section: "News",},{id: "news-our-paper-the-rate-distortion-deception-tradeoff-was-accepted-to-the-62nd-allerton-conference-on-communication-control-and-computing-tada",
          title: 'Our paper The Rate–Distortion–Deception Tradeoff was accepted to the 62nd Allerton Conference on...',
          description: "",
          section: "News",},{id: "news-two-new-preprints-task-aware-compression-with-distribution-matching-and-the-role-of-feed-forward-layers-in-transformer-dynamics",
          title: 'Two new preprints: Task-aware Compression with Distribution Matching and The Role of Feed-Forward...',
          description: "",
          section: "News",},{
        id: 'social-cv',
        title: 'CV',
        section: 'Socials',
        handler: () => {
          window.open("/assets/pdf/SemihAkkocCV.pdf", "_blank");
        },
      },{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%61%6B%6B%6F%63@%75%6D%64.%65%64%75", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/SemihAkkoc", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/msemihakkoc", "_blank");
        },
      },{
        id: 'social-scholar',
        title: 'Google Scholar',
        section: 'Socials',
        handler: () => {
          window.open("https://scholar.google.com/citations?user=2T86180AAAAJ", "_blank");
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
