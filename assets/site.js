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

      // Critically damped spring: tuned to settle a typical 100 px nav move
      // in about 380 ms at 120 Hz. These are not Apple's UIKit values.
      const springOmega = 26;
      const springPosition = { x: 0, y: 0, width: 0, height: 0 };
      const springVelocity = { x: 0, y: 0, width: 0, height: 0 };
      const springTarget = { x: 0, y: 0, width: 0, height: 0 };
      const springKeys = ['x', 'y', 'width', 'height'];
      let springFrame = 0;
      let springTime = 0;
      let glassPlaced = false;
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      const writeGlass = () => {
        glass.style.width = `${springPosition.width}px`;
        glass.style.height = `${springPosition.height}px`;
        glass.style.transform = `translate3d(${springPosition.x}px,${springPosition.y}px,0)`;
      };
      const stopGlassSpring = () => {
        if (springFrame) cancelAnimationFrame(springFrame);
        springFrame = 0;
        springTime = 0;
      };
      const settleGlassForReducedMotion = (event) => {
        if (!event.matches) return;
        stopGlassSpring();
        springKeys.forEach((key) => {
          springPosition[key] = springTarget[key];
          springVelocity[key] = 0;
        });
        if (glassPlaced) writeGlass();
      };
      if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', settleGlassForReducedMotion);
      else reducedMotion.addListener(settleGlassForReducedMotion);
      const animateGlass = (time) => {
        const elapsed = Math.min((time - springTime) / 1000 || 0, 0.05);
        springTime = time;
        const steps = Math.max(1, Math.ceil(elapsed / (1 / 120)));
        const step = elapsed / steps;
        const stiffness = springOmega * springOmega;
        const damping = 2 * springOmega;
        for (let i = 0; i < steps; i += 1) {
          springKeys.forEach((key) => {
            const acceleration = stiffness * (springTarget[key] - springPosition[key]) - damping * springVelocity[key];
            springVelocity[key] += acceleration * step;
            springPosition[key] += springVelocity[key] * step;
          });
        }
        const settled = springKeys.every((key) => Math.abs(springTarget[key] - springPosition[key]) < 0.5 && Math.abs(springVelocity[key]) < 4);
        if (settled) {
          springKeys.forEach((key) => {
            springPosition[key] = springTarget[key];
            springVelocity[key] = 0;
          });
          writeGlass();
          springFrame = 0;
          springTime = 0;
          return;
        }
        writeGlass();
        springFrame = requestAnimationFrame(animateGlass);
      };
      const placeGlass = (link, animate = false) => {
        if (!link || !menu.getClientRects().length) return;
        const menuRect = menu.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        springTarget.x = linkRect.left - menuRect.left;
        springTarget.y = linkRect.top - menuRect.top;
        springTarget.width = linkRect.width;
        springTarget.height = linkRect.height;
        glass.style.left = '0px';
        glass.style.top = '0px';
        links.forEach((item) => item.classList.toggle('is-glass-target', item === link));
        if (!glassPlaced || !animate || reducedMotion.matches) {
          stopGlassSpring();
          springKeys.forEach((key) => {
            springPosition[key] = springTarget[key];
            springVelocity[key] = 0;
          });
          glassPlaced = true;
          writeGlass();
          return;
        }
        if (!springFrame) {
          springTime = performance.now();
          springFrame = requestAnimationFrame(animateGlass);
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
          placeGlass(link, true);
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
    document.body.append(swipeRing);

    let accumulatedX = 0;
    let activeDirection = 0;
    let resetTimer;
    let navigationTimer = 0;
    let navigating = false;
    const swipeTuning = {
      navigationDistance: 54,
      wheelAxisRatio: 1.12,
      touchAxisRatio: 1.12,
      touchAxisLockDistance: 8,
      touchNavigationDistance: 12,
      idleResetMs: 320,
      routeTransitionMs: 400
    };
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const resetSwipe = () => {
      window.clearTimeout(resetTimer);
      accumulatedX = 0;
      activeDirection = 0;
      swipeRing.classList.remove('is-committing');
      swipeRing.classList.remove('is-visible');
      swipeRing.classList.remove('from-left', 'from-right');
    };
    const registerSwipeDelta = (deltaX) => {
      if (!deltaX) return;
      const direction = deltaX > 0 ? 1 : -1;
      if (navigating) {
        if (direction === activeDirection) return;
        window.clearTimeout(navigationTimer);
        navigating = false;
        resetSwipe();
      }
      const destination = swipePages[currentPageIndex + direction];
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
      const swipeProgress = Math.min(1, Math.max(accumulatedX / swipeTuning.navigationDistance, Math.abs(deltaX) / 64));
      swipeRing.style.setProperty('--swipe-opacity', (0.58 + swipeProgress * 0.42).toFixed(3));
      swipeRing.style.setProperty('--swipe-scale', (0.88 + swipeProgress * 0.12).toFixed(3));
      swipeRing.style.setProperty('--swipe-halo-alpha', (0.42 + swipeProgress * 0.5).toFixed(3));
      swipeRing.style.setProperty('--swipe-halo-soft', (0.18 + swipeProgress * 0.34).toFixed(3));
      swipeRing.classList.add('is-visible');
      window.clearTimeout(resetTimer);

      if (accumulatedX >= swipeTuning.navigationDistance) {
        navigating = true;
        swipeRing.classList.add('is-committing');
        navigationTimer = window.setTimeout(() => window.location.assign(destination.path), reducedMotion.matches ? 0 : swipeTuning.routeTransitionMs);
        return;
      }
      resetTimer = window.setTimeout(resetSwipe, swipeTuning.idleResetMs);
    };
    const onTrackpadWheel = (event) => {
      const deltaX = event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerWidth : 1);
      const deltaY = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [data-horizontal-scroll]')) return;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Let vertical and diagonal page scrolling reach the browser unchanged.
      // Only claim a wheel stream once its horizontal intent is clear; Chrome
      // and Safari use the same trackpad stream for native history gestures.
      if (absX < 0.5 || absX < absY * swipeTuning.wheelAxisRatio) return;
      if (event.cancelable) event.preventDefault();
      registerSwipeDelta(deltaX);
    };
    document.addEventListener('wheel', onTrackpadWheel, { capture: true, passive: false });

    let touchStart = null;
    let touchLast = null;
    let touchAxis = null;
    window.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) {
        touchStart = touchLast = touchAxis = null;
        return;
      }
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
      touchLast = touchStart;
      touchAxis = null;
    }, { passive: true });
    window.addEventListener('touchmove', (event) => {
      if (!touchStart || !touchLast || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const totalX = touchStart.x - touch.clientX;
      const totalY = touchStart.y - touch.clientY;
      const absX = Math.abs(totalX);
      const absY = Math.abs(totalY);
      if (!touchAxis && Math.max(absX, absY) >= swipeTuning.touchAxisLockDistance) {
        if (absX >= absY * swipeTuning.touchAxisRatio) touchAxis = 'x';
        else if (absY >= absX * swipeTuning.touchAxisRatio) touchAxis = 'y';
      }
      if (touchAxis !== 'x' || absX < swipeTuning.touchNavigationDistance) return;
      if (event.cancelable) event.preventDefault();
      const deltaX = touchLast.x - touch.clientX;
      touchLast = { x: touch.clientX, y: touch.clientY };
      registerSwipeDelta(deltaX);
    }, { passive: false });
    const finishTouchSwipe = () => {
      touchStart = touchLast = null;
      touchAxis = null;
      if (!navigating && accumulatedX) resetTimer = window.setTimeout(resetSwipe, swipeTuning.idleResetMs);
    };
    window.addEventListener('touchend', finishTouchSwipe, { passive: true });
    window.addEventListener('touchcancel', finishTouchSwipe, { passive: true });
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
