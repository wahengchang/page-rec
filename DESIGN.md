# Page Rec: Design Specification (SSOT)
**Version:** 3.0 (The Linked Node Integration)
**Context:** Chrome Extension / Developer Tool

---

## 1. Design Vision
Page Rec is an IDE-Grade Developer Tool. The UI itself serves as a literal visualization of the brand metaphor: mapping user flows (nodes) into output code (terminal). It prioritizes information throughput, precision, clear state communication, and dark-mode compatibility.

## 2. Core Layout Architecture
To maximize workspace vertical real estate, the UI follows a "Flattened Hierarchy":
* **Status Bar (Top):** Global status and Global actions (New Record).
* **Tab Bar:** View switching (Timeline vs. Step Editor) and Contextual actions (Reset).
* **Workspace (Center):** A vertical, node-based timeline of recorded steps.
* **Export Bar (Bottom):** Pinned actions for output (Copy/Download).

## 3. Brand Identity & UI DNA (The Linked Node)
The brand identity and the UI structure are identical.
* **Concept:** Emphasizes relationship and flow mapping.
* **Visual Metaphor:** Geometric circles (nodes) connected by a dashed grey line, terminating in a code prompt.
* **UI Application:** The main workspace is not a list of text; it is a visual flow of nodes connected by a dashed track, matching the logo exactly.

## 4. Visual Language & Tokens

### A. Typography & Data
* **UI Interface:** `Inter`, `system-ui`, `sans-serif` (13px).
* **Data/Selectors:** `JetBrains Mono`, `Roboto Mono`, or `monospace` (12px).
* **The Terminal Prompt:** All DOM selectors and raw data outputs must be prefixed with `> ` (e.g., `> <button#submit>`) to reinforce the terminal metaphor.
* **Weight:** 500/Medium for actions and UI labels. 400/Regular for data strings.

### B. Color Logic (Light & Dark Mode)
*Tokens mapped as CSS variables.*

| Element | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| **App Background** | `#FFFFFF` | `#0F172A` | Main workspace area |
| **Surface (Tabs)**| `#F8FAFC` | `#1E293B` | Differentiates control areas |
| **Text Primary** | `#0F172A` | `#F8FAFC` | Standard UI text |
| **Text Secondary** | `#64748B` | `#94A3B8` | Timestamps, secondary labels |
| **Primary (Indigo)** | `#4F46E5` | `#6366F1` | "Click" node color, Active Tabs |
| **Record (Red)** | `#EF4444` | `#F87171` | Status indicator, Active recording node |
| **Success (Emerald)**| `#10B981` | `#34D399` | "New Record", "Mapped" node color |
| **Input (Amber)** | `#D97706` | `#FBBF24` | "Typed" node color |
| **Flow Line (Border)**| `#E2E8F0` | `#334155` | Vertical dashed timeline track |

### C. Geometry, Iconography & Density
* **Corner Radius:** Strict 4px maximum for UI buttons; 100% (circular) for Timeline Nodes.
* **Iconography (Strict Monoline):** All icons (Copy, Download, Trash, Play) must be constructed with a uniform, monoline stroke (e.g., 1.5px or 2px) to perfectly match the logo's geometry. No filled icons permitted.
* **Density:** High. Node vertical spacing should be tight (approx 8px padding).

## 5. Component Requirements

### 5.1 Global Status Bar
* **Left:** 🔴 Stopped (or 🟢 Recording) status pill.
* **Right:** `(Count) actions` text + `[▶ New Record]` button.

### 5.2 The Node Timeline (The Workspace)
* **The Track:** A vertical dashed line (`border-left: 2px dashed var(--flow-line)`) runs the entire height of the left gutter.
* **The Nodes:** Each recorded action places a geometric circle (node) directly on top of the dashed track.
* **Node Color-Coding:** * `Click` = Indigo Node.
    * `Type` = Amber Node.
    * `Active/Recording` = Red Node.
* **Action Block:** Positioned to the right of the node. Max 2 lines. Line 1: Action (Sans-serif). Line 2: Target string (Monospace, prefixed with `>_`).

### 5.3 The Slim Footer (Export Bar)
* **Layout:** Split-button bar, attached flush to the bottom (approx 36px height).
* **Split:** Primary (85% width): `📋 Copy Code` | Secondary (15% width): `⬇` (Download icon)

## 6. Workflow States
* **Ready (Empty State):** Emphasizes the IDE feel. Shows a blinking terminal cursor in the center of the screen: `> Waiting for recording to start..._`
* **Recording:** The vertical dashed track appears. New nodes animate downwards onto the track in real-time.
* **Reviewing:** Recording stops, flow line solidifies, Footer appears for export.