1. Design Vision

Page Rec is an IDE-Grade Developer Tool (e.g., Chrome Extension context). The aesthetic must transition from a "Generic Web App" to a "High-Density Technical Workspace." It prioritizes information throughput, precision, clear state communication, and dark-mode compatibility.

2. Core Layout Architecture

To maximize workspace vertical real estate, the UI follows a "Flattened Hierarchy":

Status Bar (Top): Global status and Global actions (New Record).

Tab Bar: View switching (Timeline vs. Step Editor) and Contextual actions (Reset).

Workspace (Center): The primary scrollable list of recorded steps.

Export Bar (Bottom): Pinned actions for output (Copy/Download).

3. Visual Language & Tokens

A. Typography (Optimized for Legibility)

UI Interface: Inter, system-ui, sans-serif (13px) - Bumped from 12px for accessibility.

Data/Selectors: JetBrains Mono, Roboto Mono, or monospace (12px) - Critical for technical strings.

Weight: 500/Medium for actions (Clicked, Typed) and UI labels. 400/Regular for data strings.

B. Color Logic (Light & Dark Mode)

Tokens must be implemented as CSS variables to support system theme preferences.

Element

Light Mode

Dark Mode

Usage

App Background

#FFFFFF

#0F172A (Slate 900)

Main workspace area

Surface (Header/Tabs)

#F8FAFC (Slate 50)

#1E293B (Slate 800)

Differentiates control areas

Text Primary

#0F172A

#F8FAFC

Standard UI text

Text Secondary

#64748B

#94A3B8

Timestamps, secondary labels

Primary (Indigo)

#4F46E5

#6366F1

Primary CTA, Active Tabs, "Click" actions

Record/Stop (Red)

#EF4444

#F87171

Status indicator, Destructive actions

Success (Emerald)

#10B981

#34D399

"New Record", "Mapped" actions

Input (Amber)

#D97706 (Darker)

#FBBF24

"Typed" actions (Adjusted for contrast)

Hairline Border

#E2E8F0

#334155

Dividers, Split buttons

Hover State

#F1F5F9

#1E293B

List item row hover

C. Geometry & Density

Corner Radius: Strict 4px maximum for buttons; 0px for all container edges/panels.

Density: High. Padding inside list items should be compressed (6px - 8px vertical, 12px horizontal).

4. Component Requirements

4.1 Global Status Bar (The "Header")

Layout: Flex row, justify-content: space-between, align-items: center.

Left: 🔴 Stopped (or 🟢 Recording) status pill.

Right: (Count) actions text + [▶ New Record] button.

Style: [▶ New Record] must be a solid, high-contrast button to ensure discoverability.

4.2 The Tab System

Layout: Flat tabs. Active state uses a 2px Indigo bottom-border. Unselected tabs are muted (Text Secondary).

Contextual Trigger: The ↺ Reset Edits button only appears when "Step Editor" is active. Positioned flush-right.

4.3 The List Item (Technical Density)

Constraint: Max 2 lines per step to maintain scannability.

Typography: The action (e.g., "Clicked") is sans-serif. The target string (e.g., <button#submit>) must be monospace.

Truncation: Use text-overflow: ellipsis on DOM selector strings.

Interactions: * Row must have a subtle background color change on hover.

Truncated text must show full string natively via title attribute or a custom tooltip.

Iconography: Prepend actions with small, 14px icons (Mouse pointer for Clicked, Keyboard for Typed) to aid visual scanning.

4.4 The Slim Footer (Export Bar)

Layout: Split-button bar, attached flush to the bottom. Height should be slim (approx 36px).

Split: * Primary (85% width): 📋 Copy Code

Secondary (15% width): ⬇ (Download icon)

Divider: Must feature a 1px solid border between the two button zones to clarify they are distinct hit areas.

5. Workflow States

Ready: Large "Start Recording" empty-state in the center screen.

Recording: Header shows "Recording...", Workspace populates live, Footer is hidden.

Reviewing: Header shows "Stopped", Workspace is full, Footer is visible.