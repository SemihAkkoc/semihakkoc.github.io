---
layout: page
permalink: /publications/
title: Publications
heading: Papers & Preprints
description: Papers and preprints, newest first.
nav: true
nav_order: 2
---

<!-- _pages/publications.md -->

<p class="pub-legend">For the full record, see <a href="https://scholar.google.com/citations?user=2T86180AAAAJ">Google Scholar</a>. † denotes equal contribution.</p>

<!-- Bibsearch Feature -->

{% include bib_search.liquid %}

<div class="publications">

<h2 class="bibliography">Conference & journal papers</h2>
{% bibliography --group_by none --query @*[status=published]* %}

<h2 class="bibliography">Preprints & under review</h2>
{% bibliography --group_by none --query @*[status=preprint]* %}

</div>
