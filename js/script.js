const textEl = document.getElementById("text");
const inputEl = document.getElementById("typingInput");

let tokens = [];
let caretPos = 0;

function isSkippable(char) {
  return char === " " || char === "·";
}

function charsMatch(a, b) {
  return a?.toLowerCase() === b?.toLowerCase();
}

function getCurrentTargetIndex() {
  for (let i = caretPos; i < tokens.length; i++) {
    if (tokens[i].kind === "target") {
      return i;
    }
  }
  return -1;
}

function renderText() {
  textEl.innerHTML = "";
  const currentIndex = getCurrentTargetIndex();

  tokens.forEach((token, index) => {
    const span = document.createElement("span");
    span.textContent = token.char;
    span.dataset.index = String(index);

    if (token.kind === "inserted") {
      span.classList.add("inserted");
    } else if (token.state === "correct") {
      span.classList.add("correct");
    }

    if (index === currentIndex) {
      span.classList.add("current");
    }

    textEl.appendChild(span);
  });
}

function typeCharacter(char) {
  const currentIndex = getCurrentTargetIndex();
  if (currentIndex === -1) return;

  const currentToken = tokens[currentIndex];

  if (char === " " && isSkippable(currentToken.char)) {
    let i = currentIndex;

    while (
      i < tokens.length &&
      tokens[i].kind === "target" &&
      isSkippable(tokens[i].char)
    ) {
      tokens[i].state = "correct";
      i++;
    }

    caretPos = i;
    renderText();
    return;
  }

  if (charsMatch(char, currentToken.char)) {
    currentToken.state = "correct";
    caretPos = currentIndex + 1;
  } else {
    tokens.splice(caretPos, 0, {
      kind: "inserted",
      char
    });
    caretPos++;
  }

  renderText();
}

function backspace() {
  if (caretPos === 0) return;

  let i = caretPos - 1;

  if (tokens[i]?.kind === "inserted") {
    tokens.splice(i, 1);
    caretPos = i;
    renderText();
    return;
  }

  while (
    i >= 0 &&
    tokens[i].kind === "target" &&
    tokens[i].state === "correct" &&
    isSkippable(tokens[i].char)
  ) {
    tokens[i].state = "pending";
    i--;
  }

  if (i >= 0) {
    if (tokens[i].kind === "inserted") {
      tokens.splice(i, 1);
      caretPos = i;
    } else {
      tokens[i].state = "pending";
      caretPos = i;
    }
  } else {
    caretPos = 0;
  }

  renderText();
}

function del() {
  if (caretPos >= tokens.length) return;

  const next = tokens[caretPos];

  if (next.kind === "inserted") {
    tokens.splice(caretPos, 1);
  } else {
    next.state = "pending";
  }

  renderText();
}

function moveCaretLeft() {
  if (caretPos === 0) return;

  let newPos = caretPos - 1;

  while (
    newPos > 0 &&
    tokens[newPos - 1]?.kind === "target" &&
    tokens[newPos - 1].state === "correct" &&
    isSkippable(tokens[newPos - 1].char)
  ) {
    newPos--;
  }

  caretPos = newPos;
  renderText();
}

function moveCaretRight() {
  if (caretPos >= tokens.length) return;

  let newPos = caretPos + 1;

  while (
    newPos < tokens.length &&
    tokens[newPos - 1]?.kind === "target" &&
    tokens[newPos - 1].state === "correct" &&
    isSkippable(tokens[newPos - 1].char)
  ) {
    newPos++;
  }

  caretPos = newPos;
  renderText();
}

function findCaretTargetVertically(direction) {
  const spans = [...textEl.querySelectorAll("span")];
  if (!spans.length) return caretPos;

  let anchorIndex = Math.min(caretPos, spans.length - 1);
  if (caretPos === spans.length && spans.length > 0) {
    anchorIndex = spans.length - 1;
  }

  const anchor = spans[anchorIndex];
  if (!anchor) return caretPos;

  const anchorRect = anchor.getBoundingClientRect();
  const anchorY = anchorRect.top;
  const targetX = anchorRect.left + anchorRect.width / 2;

  let bestIndex = caretPos;
  let bestDistance = Infinity;

  for (let i = 0; i < spans.length; i++) {
    const rect = spans[i].getBoundingClientRect();

    const isTargetLine =
      direction === "up"
        ? rect.top < anchorY - 2
        : rect.top > anchorY + 2;

    if (!isTargetLine) continue;

    const dy = Math.abs(rect.top - anchorY);
    const dx = Math.abs(rect.left + rect.width / 2 - targetX);

    const score = dy * 10000 + dx;

    if (score < bestDistance) {
      bestDistance = score;
      bestIndex = i;
    }
  }

  if (bestDistance === Infinity) {
    return caretPos;
  }

  const bestSpan = spans[bestIndex];
  const bestRect = bestSpan.getBoundingClientRect();
  const midpoint = bestRect.left + bestRect.width / 2;

  return targetX < midpoint ? bestIndex : bestIndex + 1;
}

function moveCaretUp() {
  caretPos = findCaretTargetVertically("up");
  renderText();
}

function moveCaretDown() {
  caretPos = findCaretTargetVertically("down");
  renderText();
}

async function loadText() {
  try {
    const response = await fetch("./js/text.txt"); // path is relative to index.html

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = (await response.text()).trim();

    tokens = [...text].map((char) => ({
      kind: "target",
      char,
      state: "pending"
    }));

    caretPos = 0;
    renderText();
  } catch (error) {
    console.error("Failed to load text file:", error);
    textEl.textContent = "FAILED TO LOAD TEXT.";
  }
}

inputEl.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  switch (event.key) {
    case "Backspace":
      event.preventDefault();
      backspace();
      break;

    case "Delete":
      event.preventDefault();
      del();
      break;

    case "ArrowLeft":
      event.preventDefault();
      moveCaretLeft();
      break;

    case "ArrowRight":
      event.preventDefault();
      moveCaretRight();
      break;

    case "ArrowUp":
      event.preventDefault();
      moveCaretUp();
      break;

    case "ArrowDown":
      event.preventDefault();
      moveCaretDown();
      break;

    case "Home":
      event.preventDefault();
      caretPos = 0;
      renderText();
      break;

    case "End":
      event.preventDefault();
      caretPos = tokens.length;
      renderText();
      break;

    default:
      if (event.key.length === 1) {
        event.preventDefault();
        typeCharacter(event.key);
      }
      break;
  }
});

textEl.addEventListener("click", (event) => {
  const span = event.target.closest("span");
  inputEl.focus();

  if (!span) return;

  const index = Number(span.dataset.index);
  const rect = span.getBoundingClientRect();
  const midpoint = rect.left + rect.width / 2;

  caretPos = event.clientX < midpoint ? index : index + 1;
  renderText();
});

document.body.addEventListener("click", () => {
  inputEl.focus();
});

loadText();
inputEl.focus();