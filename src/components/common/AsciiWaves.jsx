import { useEffect, useRef } from "react";

// An ASCII wave field: a grid of monospace characters whose density follows a
// moving wave, so the text itself reads as a rippling surface.
//
// Written from scratch — React Bits' "Ascii Waves" is a paid Pro component, so
// this is an independent take on the same idea. The prop names deliberately
// mirror theirs (characters / color / elementSize / speed / noiseScale /
// intensity / cursor interaction) so dropping in the real one later is a
// like-for-like swap.
//
// It draws one fillText per ROW, not per cell: in a monospace font the glyph
// advance is constant, so a whole row of characters spaced correctly is just a
// string. That turns ~3,000 draw calls a frame into ~40.

const DEFAULT_CHARACTERS = " .:-+*=%@#";

// One wave unit in pixels. Wave size is measured in screen space, not in
// characters, so elementSize only ever changes how big the glyphs are — the
// waves themselves keep the same shape. At noiseScale 1 the leading wave is
// about 2π × this wide, i.e. ~600px.
const WAVE_UNIT = 96;

function AsciiWaves({
  characters = DEFAULT_CHARACTERS,
  color = "rgba(255,31,125,0.55)",
  elementSize = 15,
  speed = 1,
  noiseScale = 1,
  intensity = 1,
  angle = 45, // degrees; the direction the wave travels, so the bands run across it
  // How hard the bands snake along their own length. Past ~1.6 the bend cancels
  // the diagonal gradient and the bands flatten out into vertical stripes.
  twist = 1.2,
  interactive = true,
  cursorIntensity = 1,
  className = "",
}) {
  const canvasRef = useRef(null);

  // Pointer position lives in a ref: it changes every mousemove and must never
  // trigger a React render.
  const pointerRef = useRef({ x: 0, y: 0, strength: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const ramp = characters.length > 1 ? characters : DEFAULT_CHARACTERS;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const radians = (angle * Math.PI) / 180;
    const cosAngle = Math.cos(radians);
    const sinAngle = Math.sin(radians);

    let cellWidth = elementSize * 0.6;
    let cellHeight = elementSize * 1.05;
    let columns = 0;
    let rows = 0;
    let frame = 0;
    let running = false;
    let startedAt = performance.now();
    let elapsedWhenStopped = 0; // so pausing and resuming doesn't jump the phase

    function measure() {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) return false;

      // Cap the backing store at 2x: beyond that the cost doubles for detail
      // nobody can see in a background.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.font = `${elementSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";
      ctx.fillStyle = color;

      // The real glyph advance, so the grid lines up with whatever font resolved.
      cellWidth = ctx.measureText("M").width || elementSize * 0.6;
      cellHeight = elementSize * 1.05;
      columns = Math.ceil(width / cellWidth) + 1;
      rows = Math.ceil(height / cellHeight) + 1;
      return true;
    }

    function draw(elapsed) {
      const t = elapsed * 0.0006 * speed;
      const pointer = pointerRef.current;
      const reach = cellWidth * 14; // how far the cursor swell carries

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;

      // Everything is sampled in a frame rotated by `angle`: u runs across the
      // bands (the direction the wave travels) and v runs along them. Rotating
      // the frame rather than the canvas is what makes the bands diagonal while
      // the characters stay upright on their grid.
      // u and v are stepped by a constant per column instead of being
      // multiplied out per cell — same result, no multiply in the inner loop.
      const stepU = (cellWidth / WAVE_UNIT) * noiseScale * cosAngle;
      const stepV = (cellWidth / WAVE_UNIT) * noiseScale * sinAngle;

      for (let row = 0; row < rows; row++) {
        const y = row * cellHeight;
        const yUnit = (y / WAVE_UNIT) * noiseScale;
        let u = yUnit * sinAngle;
        let v = yUnit * cosAngle;

        let line = "";
        for (let col = 0; col < columns; col++) {
          // The bands bend as they run along v — this is the twist. Shifting u
          // by a function of v snakes the whole band instead of just rippling it.
          const bend = Math.sin(v * 0.35 - t * 0.45) * twist;

          let value =
            Math.sin(u + bend + t) * 0.62 +
            Math.sin(u * 0.5 - v * 0.25 + t * 0.7) * 0.23 +
            Math.sin(v * 0.35 + t * 0.5) * 0.15;
          value *= intensity;

          u += stepU;
          v -= stepV;

          if (pointer.strength > 0) {
            const dx = (col * cellWidth - pointer.x) / reach;
            const dy = (y - pointer.y) / reach;
            value += Math.exp(-(dx * dx + dy * dy)) * pointer.strength * cursorIntensity;
          }

          // -1..1 → 0..1, then a gamma curve so the field stays mostly sparse
          // and only the crests reach the dense glyphs.
          const level = Math.min(Math.max((value + 1) / 2, 0), 1) ** 1.6;
          line += ramp[Math.min(ramp.length - 1, Math.floor(level * ramp.length))];
        }

        ctx.fillText(line, 0, y);
      }
    }

    function loop(now) {
      if (!running) return;
      draw(now - startedAt);
      frame = requestAnimationFrame(loop);
    }

    function start() {
      if (running || columns === 0) return;
      running = true;
      startedAt = performance.now() - elapsedWhenStopped;
      frame = requestAnimationFrame(loop);
    }

    function stop() {
      if (!running) return;
      elapsedWhenStopped = performance.now() - startedAt;
      running = false;
      cancelAnimationFrame(frame);
      frame = 0;
    }

    // measure() fails while the host still has no box (it can mount at zero
    // height); the ResizeObserver below picks it up as soon as it has one.
    if (measure()) {
      if (reduceMotion) draw(0); // one still frame — the texture, no motion
      else start();
    }

    // Only animate while the hero is actually on screen.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (reduceMotion) return;
        if (entry.isIntersecting) start();
        else stop();
      },
      { threshold: 0 }
    );
    visibility.observe(host);

    const resize = new ResizeObserver(() => {
      if (!measure()) return;
      if (reduceMotion) draw(0);
      else start(); // no-op if already running; starts it if we mounted at zero size
    });
    resize.observe(host);

    function onPointerMove(e) {
      const rect = host.getBoundingClientRect();
      pointerRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        strength: 0.9,
      };
    }
    function onPointerLeave() {
      pointerRef.current = { ...pointerRef.current, strength: 0 };
    }

    if (interactive && !reduceMotion) {
      host.addEventListener("pointermove", onPointerMove);
      host.addEventListener("pointerleave", onPointerLeave);
    }

    return () => {
      stop();
      visibility.disconnect();
      resize.disconnect();
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [
    characters,
    color,
    elementSize,
    speed,
    noiseScale,
    intensity,
    angle,
    twist,
    interactive,
    cursorIntensity,
  ]);

  return (
    <canvas ref={canvasRef} className={`rx-ascii-waves ${className}`.trim()} aria-hidden="true" />
  );
}

export default AsciiWaves;
