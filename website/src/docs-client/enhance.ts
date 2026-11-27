// Browser behavior of a documentation page: a copy button on each code block, and an outline
// that follows the section in view.

const COPY_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const ALERT_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.5h.01"/></svg>';
const CHECK_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function createCopyButton(block: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-button';
  button.setAttribute('aria-label', 'Copy');
  button.title = 'Copy';
  button.innerHTML = `<span class="swap"><span class="swap-item">${COPY_ICON}</span><span class="swap-item" aria-hidden="true">${CHECK_ICON}</span><span class="swap-item" aria-hidden="true">${ALERT_ICON}</span></span>`;
  let timer = 0;
  button.addEventListener('click', async () => {
    const [copyItem, checkItem, alertItem] =
      button.querySelectorAll('.swap-item');
    let copied = true;
    try {
      await navigator.clipboard.writeText(
        block.querySelector('pre')?.textContent?.replace(/\n$/, '') ?? '',
      );
    } catch {
      copied = false;
    }
    // The check or the alert shows for a moment, then the copy icon comes back.
    copyItem?.setAttribute('aria-hidden', 'true');
    checkItem?.setAttribute('aria-hidden', copied ? 'false' : 'true');
    alertItem?.setAttribute('aria-hidden', copied ? 'true' : 'false');
    button.dataset.copied = copied ? 'true' : 'false';
    button.dataset.failed = copied ? 'false' : 'true';
    button.setAttribute('aria-label', copied ? 'Copied' : 'Copy failed');
    button.title = copied ? 'Copied' : 'Copy failed';
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      copyItem?.setAttribute('aria-hidden', 'false');
      checkItem?.setAttribute('aria-hidden', 'true');
      alertItem?.setAttribute('aria-hidden', 'true');
      button.dataset.copied = 'false';
      button.dataset.failed = 'false';
      button.setAttribute('aria-label', 'Copy');
      button.title = 'Copy';
    }, 1500);
  });
  return button;
}

export function addCopyButtons(root: HTMLElement): void {
  for (const block of root.querySelectorAll<HTMLElement>('.code-block')) {
    if (block.querySelector('.copy-button')) {
      continue;
    }
    block.append(createCopyButton(block));
  }
}

export function followHeadings(
  root: HTMLElement,
  outline: HTMLElement,
): () => void {
  const links = new Map<string, HTMLAnchorElement>();
  for (const link of outline.querySelectorAll<HTMLAnchorElement>(
    'a[href^="#"]',
  )) {
    links.set(decodeURIComponent(link.hash.slice(1)), link);
  }
  const indicator = outline.querySelector<HTMLElement>('.toc-indicator');
  let current = '';

  function placeIndicator() {
    const link = links.get(current);
    // The pill slides to the link; only transform animates, and the height snaps.
    if (indicator && link) {
      indicator.style.transform = `translateY(${link.offsetTop}px)`;
      indicator.style.height = `${link.offsetHeight}px`;
      // The first placement shows the pill where it is; later ones slide.
      if (indicator.dataset.shown !== 'true') {
        requestAnimationFrame(() => {
          indicator.dataset.shown = 'true';
        });
      }
    }
  }

  function mark(id: string) {
    if (id === current) {
      return;
    }
    links.get(current)?.removeAttribute('aria-current');
    current = id;
    const link = links.get(id);
    if (!link) {
      return;
    }
    link.setAttribute('aria-current', 'location');
    placeIndicator();
  }

  // The links change size with the width of the window and with the font that loads late.
  window.addEventListener('resize', placeIndicator);
  void document.fonts?.ready.then(placeIndicator);

  const headings: HTMLElement[] = [];
  for (const heading of root.querySelectorAll<HTMLElement>('h2[id], h3[id]')) {
    if (links.has(heading.id)) {
      headings.push(heading);
    }
  }

  // The band that counts as "in view" runs from under the sticky header to 45% of the window.
  // The first heading in the band wins. With none in it, the last one above the band does. The
  // headings are read on each scrolled frame, not from intersection events: a fast scroll,
  // PageDown or a reload can carry a heading across the band between two frames, and no event
  // fires for that.
  const bandTop = 64;
  let frame = 0;

  function update() {
    frame = 0;
    const bandBottom = window.innerHeight * 0.45;
    let above = '';
    for (const heading of headings) {
      const top = heading.getBoundingClientRect().top;
      if (top >= bandTop && top < bandBottom) {
        mark(heading.id);
        return;
      }
      if (top >= bandTop) {
        break;
      }
      above = heading.id;
    }
    // Above the first heading, the first section is the one in view.
    mark(above || (headings[0]?.id ?? ''));
  }

  function schedule() {
    if (frame === 0) {
      frame = requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', schedule, { passive: true });
  update();
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', placeIndicator);
  };
}
