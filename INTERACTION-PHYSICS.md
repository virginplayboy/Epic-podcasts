# Interaction physics notes

## What the platform documents

- UIKit exposes scroll-view bounce controls and a normal/fast deceleration-rate setting. Apple does not publish one universal set of internal constants for every scroll view interaction.
- SwiftUI's named `smooth` animation is documented as a spring with a predefined duration and no bounce. Apple's spring guidance describes preserving velocity across updates, but these SwiftUI presets are not the hidden numerical settings used by UIKit scrolling.
- WebKit documents that trackpad momentum is supplied by the platform, and that native scrolling systems provide momentum and rubber-banding. The website should therefore keep document scrolling native rather than reimplementing it in JavaScript.

## Publicly reported model, not an Apple guarantee

The often-cited rubber-band curve

```text
offset = (1 - 1 / (c * x / d + 1)) * d
```

with `c = 0.55` is a community-reported approximation attributed to reverse-engineering work. It is not an Apple-published specification, and the exact behavior can vary by component and platform. This site does not apply that curve to normal page scrolling because the browser already owns the scroll boundary, momentum, and bounce behavior.

## Website-specific approximation

- **Native page scroll:** left to the browser. The custom gesture listener only claims a clearly horizontal stream (horizontal delta must be at least 1.12 times vertical delta); vertical and diagonal input remains available to ordinary scrolling. Touch input locks to an axis at 8 CSS px and only horizontal touch gestures are cancelled for the custom page switch.
- **Navigation highlight:** an interruptible, critically damped spring. We use normalized mass `m = 1`, `ω = 26 rad/s`, stiffness `k = mω² = 676`, and damping `b = 2mω = 52`. With the implementation's 120 Hz substeps and subpixel/low-velocity stop threshold, this settles a typical 100 CSS-pixel nav move in about 380 ms. That target is a design choice, not a measured Apple value. Retargeting preserves its current position and velocity; reduced-motion users get immediate placement.
- **Page-swipe glow:** remains driven by the user's horizontal gesture. The 54 CSS-pixel navigation threshold, 320 ms idle reset, and 400 ms route transition are website interaction values, not Apple physics parameters. A reversed gesture can cancel a pending route change before navigation begins. Reduced-motion users skip the route transition delay. At Home and Connect, horizontal overscroll is absorbed so it does not trigger browser history navigation; vertical scrolling remains native.
- **Other motion:** existing native scrolling, reveal behavior, and reduced-motion CSS are retained. No extra animation library or custom scroll engine is introduced.

## Sources consulted

- [Apple — UIScrollView](https://developer.apple.com/documentation/uikit/uiscrollview)
- [Apple — UIScrollView normal deceleration rate](https://developer.apple.com/documentation/uikit/uiscrollview/decelerationrate-swift.struct/normal)
- [Apple — SwiftUI smooth spring](https://developer.apple.com/documentation/swiftui/animation/smooth)
- [Apple WWDC23 — Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/)
- [WebKit — Scrolling architecture, momentum, and rubber-banding](https://trac.webkit.org/wiki/Scrolling)
- [Ole Begemann — Inertia, Bouncing, and Rubber-Banding](https://oleb.net/blog/2014/05/scrollview-inertia-bouncing-rubberbanding/)
- [Community archive of the reported rubber-band equation](https://gist.github.com/originell/6961057)

The equation and coefficient above belong to the **publicly reported** category. Apple's API capabilities and the presence of native momentum/bounce are **documented facts**. The spring tuning and gesture thresholds are **website-specific approximations** selected for the current components.
