# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A minimalist "Word of the Day" web application that displays a randomly selected uncommon word daily with its definition, pronunciation, and part of speech. Uses the Free Dictionary API (`https://api.dictionaryapi.dev/api/v2/entries/en/{word}`) with no API key required.

## Tech Stack

- **HTML5 / Vanilla CSS / Vanilla JavaScript** — no frameworks or build tools
- **localStorage** for word history persistence
- **Static hosting** (GitHub Pages, Netlify, or Vercel)

## Architecture

This is a static site with no build step. Serve files directly or open `index.html` in a browser.

### Key Design Decisions

- **Word selection**: Filter out common/high-frequency words (top ~5,000 most used). One word per day, consistent across users.
- **Caching**: API responses should be cached efficiently; localStorage stores word history.
- **Responsive**: Mobile-first design, WCAG 2.1 AA accessible.
- **No unnecessary dependencies**: Keep the project as vanilla as possible.

## Requirements Reference

See `REQUIREMENTS.md` for full functional/non-functional requirements, UI mockups, performance targets, and success criteria.
