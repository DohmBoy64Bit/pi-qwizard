# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pi developers — both those already using Pi who are browsing extensions, and newcomers discovering Pi who are evaluating tools for their workflow.

## Product Purpose

pi-qwizard provides three interactive question tools (`question`, `questionnaire`, `question_input`) that render custom terminal UI interfaces directly inside Pi's TUI. It enables LLM agents to gather structured user input — from single-choice selections to multi-step wizards with validation — without leaving the terminal.

## Positioning

A Pi extension that renders fully custom TUI interfaces (not markdown, not HTML) for user Q&A. Combines TUI-native rendering with advanced features: conditional questions, multi-select, regex validation, rating/yes-no types, and tabbed wizard navigation — all callable via a simple API from LLM agents.

## Operating Context

- Used inside the Pi coding agent (pi.dev) terminal environment
- Called by the LLM when user input is needed to proceed
- Developers install via `pi install @dohmboy64bit/pi-qwizard` or add to settings.json
- The extension's code lives at https://github.com/DohmBoy64Bit/pi-qwizard

## Capabilities and Constraints

- Three tools: `question`, `questionnaire`, `question_input`
- Requires `@earendil-works/pi-coding-agent` as peer dependency
- TypeScript project with Biome for linting
- MIT licensed
- Current version: 1.3.2

## Brand Commitments

- Package name: `@dohmboy64bit/pi-qwizard`
- Repository: https://github.com/DohmBoy64Bit/pi-qwizard
- NPM: https://www.npmjs.com/package/@dohmboy64bit/pi-qwizard
- Voice: developer-focused, technical, clear

## Evidence on Hand

- README.md with full API reference and usage examples
- Source code at `src/index.ts`
- Test suite at `src/questions.test.cjs`
- No marketing assets, screenshots, or testimonials exist

## Product Principles

1. **Terminal-first:** The tools render inside the TUI — this is their defining characteristic.
2. **Structured input:** Every tool enforces structure — options, validation, or types.
3. **Agent-friendly:** Simple, well-documented API designed for LLM consumption.

## Accessibility & Inclusion

Keyboard navigation (↑↓, Enter, Esc, Tab) is built into all three tools. No specific accessibility standards beyond standard terminal accessibility.
