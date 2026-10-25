(() => {
  document.documentElement.classList.add('has-js');
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  if (header && toggle && nav) {
    const closeMenu = () => {
      header.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      header.classList.toggle('nav-open', open);
      if (open) header.classList.remove('is-scroll-hidden');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      requestAnimationFrame(() => nav.dispatchEvent(new Event('nav-layout')));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    document.querySelectorAll('.site-nav').forEach((menu) => {
      const links = [...menu.querySelectorAll('a')];
      if (!links.length) return;
      const glass = document.createElement('span');
      glass.className = 'nav-glass';
      glass.setAttribute('aria-hidden', 'true');
      menu.prepend(glass);

      const currentLink = () => links.find((link) => {
          const url = new URL(link.href, window.location.href);
          return url.pathname === window.location.pathname && url.hash === window.location.hash && url.hash;
        })
        || links.find((link) => link.getAttribute('aria-current') === 'page')
        || links[0];

      const placeGlass = (link, spring = false) => {
        if (!link || !menu.getClientRects().length) return;
        const menuRect = menu.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        glass.style.left = `${linkRect.left - menuRect.left}px`;
        glass.style.top = `${linkRect.top - menuRect.top}px`;
        glass.style.width = `${linkRect.width}px`;
        glass.style.height = `${linkRect.height}px`;
        links.forEach((item) => item.classList.toggle('is-glass-target', item === link));
        if (spring) {
          glass.classList.remove('is-springing');
          void glass.offsetWidth;
          glass.classList.add('is-springing');
        }
      };

      let drag = null;
      let suppressClickUntil = 0;
      const prefetchedPages = new Set();
      const prefetchPage = (link) => {
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin || url.pathname === window.location.pathname || prefetchedPages.has(url.href) || link.hasAttribute('download')) return;
        const hint = document.createElement('link');
        hint.rel = 'prefetch';
        hint.href = url.href;
        document.head.append(hint);
        prefetchedPages.add(url.href);
      };
      const nearestLink = (x, y) => links.reduce((nearest, link) => {
        const rect = link.getBoundingClientRect();
        const dx = x - (rect.left + rect.width / 2);
        const dy = y - (rect.top + rect.height / 2);
        const distance = dx * dx + dy * dy;
        return !nearest || distance < nearest.distance ? { link, distance } : nearest;
      }, null)?.link;

      const selectLink = (link, spring = false) => placeGlass(link, spring);

      menu.addEventListener('nav-layout', () => placeGlass(currentLink()));
      menu.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (!link) return;
        if (Date.now() < suppressClickUntil) {
          event.preventDefault();
          return;
        }
        placeGlass(link, true);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
        event.preventDefault();
        window.setTimeout(closeMenu, 100);
        window.setTimeout(() => { window.location.assign(link.href); }, 120);
      });
      menu.addEventListener('focusin', (event) => {
        const link = event.target.closest('a');
        if (link) {
          placeGlass(link);
          prefetchPage(link);
        }
      });
      links.forEach((link) => {
        link.addEventListener('pointerenter', () => {
          prefetchPage(link);
        });
        link.addEventListener('pointerdown', () => prefetchPage(link), { passive: true });
      });
      menu.addEventListener('pointerdown', (event) => {
        const link = event.target.closest('a');
        if (!link || event.button !== 0) return;
        drag = { x: event.clientX, y: event.clientY, link, moved: false };
      });
      menu.addEventListener('pointermove', (event) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) {
          drag.moved = true;
          menu.classList.add('is-dragging');
          try { drag.link.setPointerCapture(event.pointerId); } catch (_) {}
        }
        if (drag.moved) {
          event.preventDefault();
          const target = nearestLink(event.clientX, event.clientY);
          if (target) placeGlass(target);
        }
      });
      const finishDrag = (event, cancelled = false) => {
        if (!drag) return;
        const state = drag;
        drag = null;
        if (!state.moved) return;
        event.preventDefault();
        menu.classList.remove('is-dragging');
        if (cancelled) {
          selectLink(currentLink());
          return;
        }
        const target = nearestLink(event.clientX, event.clientY) || state.link;
        suppressClickUntil = Date.now() + 700;
        selectLink(target, true);
        prefetchPage(target);
        window.setTimeout(closeMenu, 100);
        window.setTimeout(() => { window.location.assign(target.href); }, 120);
      };
      menu.addEventListener('pointerup', finishDrag);
      menu.addEventListener('pointercancel', (event) => finishDrag(event, true));
      window.addEventListener('resize', () => placeGlass(currentLink()));
      window.addEventListener('hashchange', () => placeGlass(currentLink()));
      requestAnimationFrame(() => placeGlass(currentLink()));
    });
  }
  if (header) {
    let lastScrollY = window.scrollY;
    let lastScrollTime = performance.now();
    let lastWheelTime = 0;
    let revealTimer;
    const showHeader = () => {
      window.clearTimeout(revealTimer);
      header.classList.remove('is-scroll-hidden');
    };
    const hideHeaderBriefly = () => {
      header.classList.add('is-scroll-hidden');
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(showHeader, 420);
    };
    window.addEventListener('wheel', (event) => {
      const now = performance.now();
      const interval = Math.max(8, now - lastWheelTime);
      lastWheelTime = now;
      if (header.classList.contains('nav-open') || window.scrollY < 96 || event.deltaY < 0) {
        showHeader();
        return;
      }
      if (event.deltaY >= 36 || event.deltaY / interval >= 1.1) hideHeaderBriefly();
    }, { passive: true });
    window.addEventListener('scroll', () => {
      const now = performance.now();
      const y = window.scrollY;
      const deltaY = y - lastScrollY;
      const elapsed = Math.max(1, now - lastScrollTime);
      const speed = deltaY / elapsed;
      lastScrollY = y;
      lastScrollTime = now;

      if (header.classList.contains('nav-open') || y < 96 || deltaY < -3) {
        showHeader();
        return;
      }
      if (deltaY > 0 && speed >= 0.85) {
        hideHeaderBriefly();
      }
    }, { passive: true });
  }
  // Horizontal trackpad swipes move through the primary pages. A ring blooms
  // from the edge in the direction of travel, then the next page is opened.
  const swipePages = [
    { path: '/', label: 'Home' },
    { path: '/process/', label: 'Studio' },
    { path: '/case-studies/', label: 'Work' },
    { path: '/about/', label: 'About' },
    { path: '/trust/', label: 'Trust' },
    { path: '/connect/', label: 'Connect' }
  ];
  const currentPath = window.location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
  const currentPageIndex = swipePages.findIndex((page) => page.path === currentPath);
  if (currentPageIndex !== -1) {
    const swipeRing = document.createElement('div');
    swipeRing.className = 'page-swipe-ring';
    swipeRing.setAttribute('aria-hidden', 'true');
    swipeRing.innerHTML = '<span></span><span></span>';
    document.body.append(swipeRing);

    const adjacentPages = [swipePages[currentPageIndex - 1], swipePages[currentPageIndex + 1]];
    adjacentPages.filter(Boolean).forEach((page) => {
      const hint = document.createElement('link');
      hint.rel = 'prefetch';
      hint.href = page.path;
      document.head.append(hint);
    });

    let accumulatedX = 0;
    let activeDirection = 0;
    let resetTimer;
    let navigating = false;
    const resetSwipe = () => {
      window.clearTimeout(resetTimer);
      accumulatedX = 0;
      activeDirection = 0;
      swipeRing.classList.remove('is-visible');
      swipeRing.classList.remove('from-left', 'from-right');
    };
    window.addEventListener('wheel', (event) => {
      if (navigating) {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2) event.preventDefault();
        return;
      }
      const deltaX = event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerWidth : 1);
      const deltaY = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [data-horizontal-scroll]')) return;

      const direction = deltaX > 0 ? 1 : -1;
      const destination = swipePages[currentPageIndex + direction];
      if (event.cancelable) event.preventDefault();
      if (!destination) {
        resetSwipe();
        return;
      }

      if (direction !== activeDirection) {
        accumulatedX = 0;
        activeDirection = direction;
        swipeRing.classList.remove('from-left', 'from-right');
        swipeRing.classList.add(direction > 0 ? 'from-right' : 'from-left');
      }
      accumulatedX += Math.abs(deltaX);
      const swipeProgress = Math.min(1, Math.max(accumulatedX / 110, Math.abs(deltaX) / 80));
      swipeRing.style.setProperty('--swipe-opacity', (0.24 + swipeProgress * 0.76).toFixed(3));
      swipeRing.style.setProperty('--swipe-scale', (0.82 + swipeProgress * 0.18).toFixed(3));
      swipeRing.style.setProperty('--swipe-blur', `${20 + swipeProgress * 64}px`);
      swipeRing.style.setProperty('--swipe-shadow-alpha', (0.18 + swipeProgress * 0.56).toFixed(3));
      swipeRing.style.setProperty('--swipe-inner-alpha', (0.06 + swipeProgress * 0.26).toFixed(3));
      swipeRing.style.setProperty('--swipe-halo-alpha', (0.12 + swipeProgress * 0.56).toFixed(3));
      swipeRing.style.setProperty('--swipe-halo-soft', (0.08 + swipeProgress * 0.35).toFixed(3));
      swipeRing.classList.add('is-visible');
      window.clearTimeout(resetTimer);

      if (accumulatedX >= 110) {
        navigating = true;
        swipeRing.classList.add('is-committing');
        window.setTimeout(() => window.location.assign(destination.path), 400);
        return;
      }
      resetTimer = window.setTimeout(resetSwipe, 520);
    }, { passive: false });
  }
  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }
  document.querySelectorAll('[data-youtube-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const videoId = button.dataset.youtubeId;
      if (!videoId) return;
      const player = document.createElement('iframe');
      player.className = 'work-video-player';
      player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&controls=1&playsinline=1&rel=0`;
      player.title = button.dataset.videoTitle || 'Selected work video';
      player.loading = 'lazy';
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      player.allowFullscreen = true;
      button.replaceWith(player);
    }, { once: true });
  });
  const filterButtons = document.querySelectorAll('[data-filter]');
  const projectCards = document.querySelectorAll('[data-category]');
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      filterButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      projectCards.forEach((card) => {
        card.hidden = filter !== 'all' && card.dataset.category !== filter;
      });
    });
  });
  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });
})();
