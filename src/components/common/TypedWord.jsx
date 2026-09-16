import { useEffect, useState } from "react";

const WORDS = ["moves", "sells", "converts", "performs"];

const TYPE_MS = 90;
const DELETE_MS = 45;
const HOLD_MS = 1600;
const PAUSE_MS = 400;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function TypedWord() {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(WORDS[0]);
  const [deleting, setDeleting] = useState(false);
  const [still] = useState(prefersReducedMotion);

  useEffect(() => {
    if (still) return;

    const word = WORDS[index];
    const atFullWord = !deleting && text === word;
    const atEmpty = deleting && text === "";

    let delay = deleting ? DELETE_MS : TYPE_MS;
    if (atFullWord) delay = HOLD_MS;
    if (atEmpty) delay = PAUSE_MS;

    const id = setTimeout(() => {
      if (atFullWord) {
        setDeleting(true);
      } else if (atEmpty) {
        setDeleting(false);
        setIndex((i) => (i + 1) % WORDS.length);
      } else if (deleting) {
        setText(word.slice(0, text.length - 1));
      } else {
        setText(word.slice(0, text.length + 1));
      }
    }, delay);

    return () => clearTimeout(id);
  }, [text, deleting, index, still]);

  return (
    <>
      {/* keeps the heading readable for screen readers and crawlers */}
      <span className="rx-sr-only">{WORDS[0]}</span>
      <span className="rx-typed-line" aria-hidden="true">
        {text}
        <span className="rx-type-cursor"></span>
      </span>
    </>
  );
}

export default TypedWord;
