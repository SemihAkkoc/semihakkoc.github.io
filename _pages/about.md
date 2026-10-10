---
layout: about
title: About
permalink: /
full_width: true # one-page layout without the default content container
full_name: Mahmut Semih Akkoç
resume_pdf: /assets/pdf/SemihAkkocResume.pdf # one-page resume (the CV path is in _data/socials.yml)

# ---------------------------------------------------------------- hero
hero:
  label: Ph.D. Student · Electrical & Computer Engineering · UMD
  title: >
    I study the fundamental limits of what can be discarded,<br>
    in <strong>data compression</strong> and inside <strong>large language models</strong>.
  tags:
    - Information Theory
    - Rate–Distortion Theory
    - LLM Interpretability
    - Transformer Dynamics
  status: Seeking a Summer 2027 research internship # shown as a small badge; delete to hide

# ---------------------------------------------------------------- 01 · About (bio is the text below the front matter)
profile:
  image: prof_pic_hero.jpg
  details:
    - label: Location
      value: College Park, MD
    - label: Advisor
      value: Prof. Sennur Ulukus
    - label: Program
      value: ECE Ph.D.
    - label: Languages
      value: TR · EN

# ---------------------------------------------------------------- 02 · Research
research:
  intro: >
    My research establishes the fundamental limits of what can be discarded: deriving
    rate–distortion characterizations that govern task-aware compression, and analyzing
    transformers as tractable dynamical systems to locate where representational work actually happens.
  areas:
    - title: Task-aware compression
      text: >
        Rate–distortion limits for compression whose output is consumed by a downstream model,
        including classifiers trained on a different distribution than the source.
    - title: Transformers as dynamical systems
      text: >
        Treating tokens as interacting particles to analyze attention and feed-forward blocks,
        and to find where the compressive work inside a network happens.
    - title: Steering output statistics
      text: >
        How far a lossy codec can steer the statistics of what it outputs while staying faithful
        to the source, with uses in watermarking, output auditing, and privacy.

# ---------------------------------------------------------------- 05 · Projects
projects:
  - name: Li-Fi Protocol on an FPGA
    url: https://github.com/SemihAkkoc/LiFi
    text: >
      A complete Li-Fi communication stack in VHDL on a Xilinx Artix-7 (BASYS3): modular encoding
      and decoding of audio and text, LED transmission and LDR reception, with payloads in on-chip ROM.
    tech: [VHDL, FPGA, Optical Comms]
  - name: Semantic Communication Prototype
    tag: Huawei R&D
    text: >
      A two-node network on Raspberry Pi that extracts visual semantics on-device, cutting transmission
      from a 10 Mbps video stream to about 10 bps of task-relevant tokens.
    tech: [Raspberry Pi, Sensor Fusion, TCP]
  - name: Dielectric Constant Prediction
    url: https://github.com/SemihAkkoc/DielectricConstantPrediction
    text: >
      A suspended ring resonator model in MATLAB and CST Studio that estimates dielectric constant and
      loss tangent, generalized with lookup tables and polynomial fits so it transfers across materials.
    tech: [MATLAB, CST Studio, RF]
  - name: Multithreaded File Transfer
    url: https://github.com/SemihAkkoc/file_transfer
    text: >
      A socket-based file transfer system in C++ that handles arbitrary file types through binary I/O,
      using factory and observer patterns to keep sockets and workers decoupled.
    tech: [C++, Sockets, Multithreading]

# ---------------------------------------------------------------- 07 · News
announcements:
  enabled: true # includes a list of news items
  scrollable: false # adds a vertical scroll bar if there are more than 3 news items
  limit: 5 # leave blank to include all the news in the `_news` folder

# ---------------------------------------------------------------- 08 · Contact
contact:
  heading: Research and internships
  text: >
    I'm happy to talk about information theory, compression, and interpretability, and I'm currently
    looking for a <strong>Summer 2027 research internship</strong> in efficient AI, compression, or LLM
    interpretability. Email is the best way to reach me.
---

I'm a Ph.D. student in Electrical and Computer Engineering at the University of Maryland, College Park, advised by <a href="https://user.eng.umd.edu/~ulukus/">Prof. Sennur Ulukus</a>.

My research has two sides. On the **compression** side, I derive rate–distortion characterizations for _task-aware_ compression: how many bits you need when the reconstruction is consumed by a downstream model rather than a person, and how far a lossy codec can steer the statistics of what it outputs. On the **interpretability** side, I analyze transformers as tractable dynamical systems, treating tokens as interacting particles to find where the representational work inside a network actually happens.

Before Maryland, I received my B.Sc. in Electrical and Electronics Engineering from Bilkent University, with an exchange semester at the National University of Singapore. At Bilkent I worked on semantic signal processing with Prof. Orhan Arıkan and on computational electromagnetics with Prof. Vakur B. Ertürk. I've also interned at Huawei (semantic communications), ASELSAN (RF & microwave systems), and BİTES (software engineering).
