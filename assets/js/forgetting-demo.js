// Two-parameter model of catastrophic forgetting for the CMSC 838B lecture
// (_pages/cmsc838b-lecture.html). Styles live in _sass/_lecture.scss.
//
// Task k asks for one linear output: L_k(θ) = ½ (u_k·θ − 1)², with unit vectors
// u1 = (1, 0) and u2 = (cos φ, sin φ). Each task's solutions form a line, and the
// two lines cross at the joint solution. Training on task 1 from θ0 = 0 lands on
// θ* = u1; the widget then fine-tunes on task 2 and shows what happens to task 1.
//
// Every .fd-demo element becomes one widget:
//   data-angle="60"            initial angle φ between the tasks, in degrees
//   data-methods="ft,ewc,ogd"  optimizers to offer (default: ft only)
//   data-chart="false"         hide the forgetting-vs-similarity chart
//   data-note="false"          hide the one-line explanation under the readouts
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const STEPS = 40; // fine-tuning budget, the same for every method
  const LR = 0.5;
  const EWC_LAMBDA = 1;
  const METHODS = {
    ft: { label: "Fine-tune", note: "Plain gradient descent on task 2 moves only along u₂ and stops at the nearest task-2 solution." },
    ewc: { label: "EWC", note: "Task 2 plus a Fisher penalty that anchors θ along task 1's sensitive direction. Here the penalty is exact, so EWC slides to the joint solution." },
    ogd: { label: "Projection", note: "OGD removes the part of the task-2 gradient along task 1's gradient direction. It walks straight to the joint solution, but slowly when the tasks are similar." },
  };

  // Plane: θ ∈ [-0.3, 2.1] × [-0.4, 1.4], drawn at 400 × 300
  const PX = 400 / 2.4;
  const px = (x) => (x + 0.3) * PX;
  const py = (y) => (1.4 - y) * PX;

  // Chart: similarity c = cos φ on x, forgetting on y
  const CH = { l: 54, r: 386, t: 22, b: 236, fmax: 0.035 };
  const cx = (c) => CH.l + c * (CH.r - CH.l);
  const cy = (f) => CH.b - (Math.min(f, CH.fmax) / CH.fmax) * (CH.b - CH.t);

  let uid = 0;

  function run(method, phi) {
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    let x = 1;
    let y = 0;
    const path = [[x, y]];
    for (let i = 0; i < STEPS; i++) {
      const r2 = c * x + s * y - 1;
      let gx = c * r2;
      const gy = s * r2;
      if (method === "ewc") gx += EWC_LAMBDA * (x - 1);
      else if (method === "ogd") gx = 0; // project out u1 = (1, 0)
      x -= LR * gx;
      y -= LR * gy;
      path.push([x, y]);
    }
    const l2start = 0.5 * (c - 1) ** 2;
    const l2 = 0.5 * (c * x + s * y - 1) ** 2;
    return {
      path,
      x,
      y,
      forgetting: 0.5 * (x - 1) ** 2,
      learned: l2start > 1e-9 ? Math.max(0, 1 - l2 / l2start) : 1,
    };
  }

  function curve(method) {
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const c = i / 100;
      pts.push([c, run(method, Math.acos(c)).forgetting]);
    }
    return pts;
  }

  function el(name, attrs, parent, text) {
    const node = document.createElementNS(NS, name);
    for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  const fmt = (v) => v.toFixed(3);

  // Clip the infinite line {p0 + t d} to the plane's box (Liang–Barsky)
  function clipLine(p0, d) {
    const box = [-0.3, 2.1, -0.4, 1.4];
    let t0 = -10;
    let t1 = 10;
    const checks = [
      [-d[0], p0[0] - box[0]],
      [d[0], box[1] - p0[0]],
      [-d[1], p0[1] - box[2]],
      [d[1], box[3] - p0[1]],
    ];
    for (const [p, q] of checks) {
      if (Math.abs(p) < 1e-12) continue;
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
    }
    return [
      [p0[0] + t0 * d[0], p0[1] + t0 * d[1]],
      [p0[0] + t1 * d[0], p0[1] + t1 * d[1]],
    ];
  }

  function build(root) {
    const id = "fd" + uid++;
    const methods = (root.dataset.methods || "ft").split(",").filter((m) => METHODS[m]);
    const showChart = root.dataset.chart !== "false";
    const showNote = root.dataset.note !== "false";
    const state = { phi: ((Number(root.dataset.angle) || 60) * Math.PI) / 180, method: methods[0] };

    root.innerHTML = "";

    // Controls
    const controls = document.createElement("div");
    controls.className = "fd-controls";
    const label = document.createElement("label");
    label.className = "fd-slider";
    label.innerHTML = '<span>Angle between tasks</span><input type="range" min="0" max="90" step="1"><output></output>';
    const slider = label.querySelector("input");
    const output = label.querySelector("output");
    slider.value = Math.round((state.phi * 180) / Math.PI);
    slider.setAttribute("aria-label", "Angle between task 1 and task 2, in degrees");
    controls.appendChild(label);

    const buttons = [];
    if (methods.length > 1) {
      const group = document.createElement("div");
      group.className = "fd-methods";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "Fine-tuning method");
      methods.forEach((m) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = METHODS[m].label;
        b.dataset.method = m;
        b.addEventListener("click", () => {
          state.method = m;
          update();
          b.blur();
        });
        group.appendChild(b);
        buttons.push(b);
      });
      controls.appendChild(group);
    }
    root.appendChild(controls);

    // Panels
    const panels = document.createElement("div");
    panels.className = "fd-panels" + (showChart ? "" : " is-single");
    root.appendChild(panels);

    // Parameter plane
    const plane = el("svg", { viewBox: "0 0 400 300", role: "img", "aria-label": "Parameter plane with the solution lines of both tasks and the fine-tuning path" }, panels);
    const defs = el("defs", {}, plane);
    const clip = el("clipPath", { id: id + "-clip" }, defs);
    el("rect", { x: 0, y: 0, width: 400, height: 300 }, clip);
    const g = el("g", { "clip-path": "url(#" + id + "-clip)" }, plane);

    el("line", { x1: px(-0.3), y1: py(0), x2: px(2.1), y2: py(0), class: "fd-axis" }, g);
    el("line", { x1: px(0), y1: py(-0.4), x2: px(0), y2: py(1.4), class: "fd-axis" }, g);
    el("text", { x: px(2.08), y: py(0) - 6, "text-anchor": "end", class: "fd-t fd-t-small" }, plane, "θ₁");
    el("text", { x: px(0) - 6, y: py(1.37), "text-anchor": "end", class: "fd-t fd-t-small" }, plane, "θ₂");

    const band1 = el("line", { x1: px(1), y1: py(-0.4), x2: px(1), y2: py(1.4), class: "fd-band fd-c1" }, g);
    const line1 = el("line", { x1: px(1), y1: py(-0.4), x2: px(1), y2: py(1.4), class: "fd-sol fd-c1" }, g);
    const band2 = el("line", { class: "fd-band fd-c2" }, g);
    const line2 = el("line", { class: "fd-sol fd-c2" }, g);
    el("text", { x: px(1) + 7, y: py(1.4) + 15, class: "fd-t" }, plane, "task 1 solutions");
    const label2 = el("text", { class: "fd-t" }, plane, "task 2 solutions");

    el("line", { x1: px(0), y1: py(0), x2: px(1), y2: py(0), class: "fd-path fd-c1 fd-dash" }, g);
    el("circle", { cx: px(0), cy: py(0), r: 4.5, class: "fd-hollow" }, g);
    el("text", { x: px(0) + 8, y: py(0) + 16, class: "fd-t fd-t-small" }, plane, "pretrained θ₀");

    const gap = el("line", { class: "fd-gap" }, g);
    const gapLabel = el("text", { class: "fd-t fd-t-small fd-t-forget", "text-anchor": "middle" }, plane, "forgetting");
    const path = el("polyline", { class: "fd-path fd-c2" }, g);
    const joint = el("path", { class: "fd-joint" }, g);
    const jointLabel = el("text", { class: "fd-t fd-t-small" }, plane, "joint solution");
    el("circle", { cx: px(1), cy: py(0), r: 6, class: "fd-dot fd-f1" }, g);
    el("text", { x: px(1) + 9, y: py(0) + 17, class: "fd-t fd-t-strong" }, plane, "θ*");
    const end = el("circle", { r: 6, class: "fd-dot fd-f2" }, g);
    const endLabel = el("text", { class: "fd-t fd-t-strong" }, plane, "after task 2");

    // Forgetting vs similarity
    let chart = null;
    if (showChart) {
      const svg = el("svg", { viewBox: "0 0 400 300", role: "img", "aria-label": "Forgetting as a function of task similarity" }, panels);
      chart = { svg };
      [0, 0.01, 0.02, 0.03].forEach((f) => {
        el("line", { x1: CH.l, y1: cy(f), x2: CH.r, y2: cy(f), class: f === 0 ? "fd-axis" : "fd-grid" }, svg);
        el("text", { x: CH.l - 8, y: cy(f) + 4, "text-anchor": "end", class: "fd-t fd-t-mono" }, svg, f === 0 ? "0" : f.toFixed(2));
      });
      [0, 0.25, 0.5, 0.75, 1].forEach((c) => {
        el("line", { x1: cx(c), y1: CH.b, x2: cx(c), y2: CH.b + 4, class: "fd-axis" }, svg);
        el("text", { x: cx(c), y: CH.b + 17, "text-anchor": "middle", class: "fd-t fd-t-mono" }, svg, String(c));
      });
      el("text", { x: CH.l, y: CH.b + 34, class: "fd-t fd-t-small" }, svg, "orthogonal");
      el("text", { x: CH.r, y: CH.b + 34, "text-anchor": "end", class: "fd-t fd-t-small" }, svg, "identical");
      el("text", { x: (CH.l + CH.r) / 2, y: CH.b + 56, "text-anchor": "middle", class: "fd-t" }, svg, "task similarity  cos φ");
      el("text", { x: CH.l - 2, y: CH.t - 8, class: "fd-t fd-t-small" }, svg, "forgetting (task-1 loss after fine-tuning)");
      chart.ref = el("polyline", { class: "fd-curve-ref" }, svg);
      chart.refLabel = el("text", { class: "fd-t fd-t-small", "text-anchor": "middle" }, svg, "fine-tune");
      chart.curve = el("polyline", { class: "fd-curve" }, svg);
      chart.cross = el("line", { y1: CH.t, y2: CH.b, class: "fd-cross", visibility: "hidden" }, svg);
      chart.marker = el("circle", { r: 6, class: "fd-dot fd-ff" }, svg);
      chart.tip = el("text", { class: "fd-t fd-t-mono fd-t-strong", visibility: "hidden" }, svg);
      const hit = el("rect", { x: CH.l - 6, y: CH.t, width: CH.r - CH.l + 12, height: CH.b - CH.t + 8, class: "fd-hit" }, svg);

      const fromEvent = (event) => {
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const local = pt.matrixTransform(svg.getScreenCTM().inverse());
        return Math.max(0, Math.min(1, (local.x - CH.l) / (CH.r - CH.l)));
      };
      hit.addEventListener("pointermove", (event) => {
        const c = fromEvent(event);
        const f = run(state.method, Math.acos(c)).forgetting;
        chart.cross.setAttribute("x1", cx(c));
        chart.cross.setAttribute("x2", cx(c));
        chart.cross.setAttribute("visibility", "visible");
        chart.tip.textContent = "cos φ " + c.toFixed(2) + " · F " + fmt(f);
        const right = cx(c) > (CH.l + CH.r) / 2;
        chart.tip.setAttribute("x", cx(c) + (right ? -8 : 8));
        chart.tip.setAttribute("y", CH.t + 12);
        chart.tip.setAttribute("text-anchor", right ? "end" : "start");
        chart.tip.setAttribute("visibility", "visible");
      });
      hit.addEventListener("pointerleave", () => {
        chart.cross.setAttribute("visibility", "hidden");
        chart.tip.setAttribute("visibility", "hidden");
      });
      hit.addEventListener("click", (event) => {
        state.phi = Math.acos(fromEvent(event));
        slider.value = Math.round((state.phi * 180) / Math.PI);
        update();
      });
    }

    // Readouts
    const readouts = document.createElement("div");
    readouts.className = "fd-readouts";
    readouts.setAttribute("aria-live", "polite");
    readouts.innerHTML =
      '<span class="is-forget"><i></i>Forgetting (task-1 loss) <b data-k="f"></b></span>' +
      '<span class="is-learn"><i></i>Task 2 learned <b data-k="l"></b></span>';
    root.appendChild(readouts);
    const note = document.createElement("p");
    note.className = "fd-note";
    note.hidden = !showNote;
    root.appendChild(note);

    const pts = (arr, fx, fy) => arr.map((p) => fx(p[0]).toFixed(1) + "," + fy(p[1]).toFixed(1)).join(" ");

    function update() {
      const phi = state.phi;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const deg = Math.round((phi * 180) / Math.PI);
      output.textContent = deg + "° · cos φ = " + c.toFixed(2);
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.method === state.method)));

      // Task-2 solution line
      const [a, b] = clipLine([c, s], [-s, c]);
      [band2, line2].forEach((ln) => {
        ln.setAttribute("x1", px(a[0]));
        ln.setAttribute("y1", py(a[1]));
        ln.setAttribute("x2", px(b[0]));
        ln.setAttribute("y2", py(b[1]));
      });
      // Label runs along the task-2 line from its upper-left end, on the side away from θ*
      const along = 0.14;
      const lx = b[0] + s * along + c * 0.07;
      const ly = b[1] - c * along + s * 0.07;
      const angle = (Math.atan2(c, s) * 180) / Math.PI;
      label2.setAttribute("x", px(lx));
      label2.setAttribute("y", py(ly));
      label2.setAttribute("text-anchor", "start");
      label2.setAttribute("transform", "rotate(" + angle.toFixed(1) + " " + px(lx).toFixed(1) + " " + py(ly).toFixed(1) + ")");

      // Joint solution: the crossing of the two lines (undefined when they coincide)
      if (deg >= 1) {
        const jx = px(1);
        const jy = py(Math.tan(phi / 2));
        const r = 8;
        let d = "";
        for (let i = 0; i < 10; i++) {
          const ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.45 : r;
          d += (i ? "L" : "M") + (jx + rr * Math.cos(ang)).toFixed(1) + "," + (jy + rr * Math.sin(ang)).toFixed(1);
        }
        joint.setAttribute("d", d + "Z");
        jointLabel.setAttribute("x", jx - 12);
        jointLabel.setAttribute("y", jy - 4);
        jointLabel.setAttribute("text-anchor", "end");
        joint.setAttribute("visibility", "visible");
        jointLabel.setAttribute("visibility", "visible");
      } else {
        joint.setAttribute("visibility", "hidden");
        jointLabel.setAttribute("visibility", "hidden");
      }

      const res = run(state.method, phi);
      path.setAttribute("points", pts(res.path, px, py));
      end.setAttribute("cx", px(res.x));
      end.setAttribute("cy", py(res.y));
      endLabel.setAttribute("x", px(res.x) + 10);
      endLabel.setAttribute("y", py(res.y) + 18);
      endLabel.setAttribute("visibility", Math.hypot(res.x - 1, res.y) > 0.12 ? "visible" : "hidden");

      // Horizontal gap to the task-1 line: u1·θ − 1, whose square / 2 is the forgetting
      const gapVisible = Math.abs(res.x - 1) > 0.02;
      gap.setAttribute("x1", px(1));
      gap.setAttribute("x2", px(res.x));
      gap.setAttribute("y1", py(res.y));
      gap.setAttribute("y2", py(res.y));
      gap.setAttribute("visibility", gapVisible ? "visible" : "hidden");
      gapLabel.setAttribute("x", (px(1) + px(res.x)) / 2);
      gapLabel.setAttribute("y", py(res.y) - 9);
      gapLabel.setAttribute("visibility", Math.abs(res.x - 1) > 0.25 ? "visible" : "hidden");

      readouts.querySelector('[data-k="f"]').textContent = fmt(res.forgetting);
      readouts.querySelector('[data-k="l"]').textContent = Math.round(res.learned * 100) + "%";
      note.textContent = METHODS[state.method].note + (methods.length > 1 ? " Every method gets the same " + STEPS + " steps." : "");

      if (chart) {
        chart.curve.setAttribute("points", pts(curve(state.method), cx, cy));
        const showRef = state.method !== "ft";
        chart.ref.setAttribute("points", showRef ? pts(curve("ft"), cx, cy) : "");
        chart.refLabel.setAttribute("visibility", showRef ? "visible" : "hidden");
        chart.refLabel.setAttribute("x", cx(0.5));
        chart.refLabel.setAttribute("y", cy(run("ft", Math.acos(0.5)).forgetting) - 9);
        chart.marker.setAttribute("cx", cx(c));
        chart.marker.setAttribute("cy", cy(res.forgetting));
      }
    }

    slider.addEventListener("input", () => {
      state.phi = (Number(slider.value) * Math.PI) / 180;
      update();
    });

    // Keep swipes on the widget from changing slides in presentation mode
    ["touchstart", "touchend"].forEach((type) => root.addEventListener(type, (event) => event.stopPropagation(), { passive: true }));

    update();
  }

  document.querySelectorAll(".fd-demo").forEach(build);
})();
