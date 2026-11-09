# 🏎️ Clean Cockpit & Minimal HUD Driving Mode

A distraction-free, high-immersion racing HUD mode that automatically hides all top bars, menus, and lap displays during active driving, keeping only the **Speedometer (KM/H)**, **3D Minimap Radar**, and a sleek **Compact Active Powerup Icon** visible on screen.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during the planning phase:
> - **Visible HUD Elements while Driving**: Only the bottom-right Angled Speedometer gauge, bottom-left 3D Minimap radar, and the compact active Powerup icon slot will be visible.
> - **Top Bar & Lap Timer Behavior**: Automatically hides upon starting the race / pressing accelerate (`W` / `Start Time Trial`).
> - **Restoring Full HUD**: Pressing the `H` key toggles full HUD on/off, or hovering the mouse cursor near the top edge of the screen reveals the top bar cleanly (peek view).

---

## 1. Overview & Core Concept

- **The Problem**: While racing on the desk coaster at high speed, top header elements (the "Desk Racer" brand title, lap counter, lap timer split, and sound toggle) occupy peripheral vision and distract from precision racing lines and apex turning.
- **The Solution**: An intelligent "Clean Cockpit / Zen Driving" HUD state that seamlessly collapses top-screen clutter when the race begins, maintaining pure focus on track navigation and velocity, while preserving the critical Speedometer, Minimap, and active Powerup slot.
- **Key Value**: Delivers the tactile thrill of an arcade cockpit simulation with an unobstructed view of the desktop diorama, desk monuments, and track geometry.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Pre-Race / Start Screen**: Full HUD and Welcome Dialog are visible as usual. The player can adjust camera views, review controls, and inspect the track.
2. **Race Start / Accelerate**: Pressing `ENTER` on the start dialog or applying throttle (`W` / `ArrowUp` / Touch Accel) enters **Active Driving Mode**.
   - The top header (`.hud-top-bar`), lap timer, and sound button smoothly fade out and slide up off-screen (`translateY(-100%)`, `opacity: 0`).
   - The bottom bar remains pinned: **Bottom-Left 3D Minimap** and **Bottom-Right Angled Speedometer**.
   - The **Powerup Item Slot** transitions smoothly into a minimal, floating neon pill tucked just above the speedometer or floating unobtrusively in the corner, keeping powerups fully usable via `[SPACE]`.
3. **Top Edge Hover / Peek**: Moving the mouse within the top 36px of the screen smoothly peeks the top bar back into view (`opacity: 1`, `translateY(0)`).
4. **Keyboard Toggle (`H`)**: Pressing `H` (or clicking a subtle corner toggle) manually locks the full HUD visible or enters Zen Mode at any time.
5. **Race Finish**: When crossing the finish line on Lap 3, the full HUD and celebratory finish dialog smoothly fade back in.

### Visual Architecture & Theme
- **Obsidian & Electric Cyan Theme**: Clean contrast matching the existing Orbitron italic typography and cyan-glow speedometer polygons.
- **Smooth Easing**: 0.28s cubic-bezier (`cubic-bezier(0.16, 1, 0.3, 1)`) transitions for zero visual jarring.

---

## 3. Technical Architecture & Component Mapping

```
┌─────────────────────────────────────────────────────────────┐
│               TOP EDGE HOVER SENSOR (36px)                  │
│  [ HUD Top Bar: Brand · Lap Widget · Mute ] (Hidden while driving) │
│                                                             │
│                                                             │
│                      3D WEBGL VIEWPORT                      │
│                  (Unobstructed Clean View)                  │
│                                                             │
│                                                             │
│  ┌────────────────────────┐     ┌────────────────────────┐  │
│  │    3D MINIMAP RADAR    │     │ [⚡ POWERUP]           │  │
│  │ (Live Track Position)  │     │ ANGLED SPEEDOMETER     │  │
│  └────────────────────────┘     └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component & State Changes:
- **`src/style.css`**:
  - Add `.hud-zen-mode` state class on `#hud-root`:
    - Automatically hides `#hud-brand-logo`, `#btn-mute-sound`, `#hud-lap-widget` with smooth CSS transitions.
    - Repositions `#hud-powerup-widget` to a sleek compact floating badge docked just above the speedometer on the bottom right (or neat upper corner with zero occlusion).
  - Add `.top-hover-peek` hover trigger on the top viewport zone.
- **`src/main.js`**:
  - Connect racing state triggers: when `stepF1StartCountdown` finishes, or when throttle is engaged (`st.speed > 0.02`), activate Zen HUD mode.
  - Add `H` key listener to toggle HUD visibility manually.
  - Restore full HUD upon race completion (`onRaceFinish`).

---

## 4. Key Decisions & Trade-Offs

- **Automatic Transition vs. Manual Toggle**:
  - *Decision*: Automatically transition into clean HUD mode when driving begins, with instant manual toggle via `H` key and top-edge mouse hover.
  - *Rationale*: Players want immediate immersion without needing to hunt for settings menus, while retaining easy access to the lap timer when desired.
- **Powerup Item Widget Placement**:
  - *Decision*: In clean driving mode, condense the powerup widget into an ergonomic mini badge docked right above the speed readout so your speed and item inventory are read in a single glance.
