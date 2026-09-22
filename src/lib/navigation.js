import { tracks, trackLabel } from '../content/tracks.js'

/**
 * Navigation is two-level on purpose.
 *
 * TRACKS are the only links shown on every page — one entry per track, so the
 * global bar stays the same size no matter how many pages a track grows.
 *
 * TRACK_SECTIONS holds each track's own pages. They appear in a second bar that
 * is only rendered while you are inside that track, which keeps DSA tools off
 * the app home page and out of the other tracks.
 */
export const TRACKS = [
  { label: 'Home', to: '/', exact: true },
  ...tracks.map((t) => ({ label: trackLabel(t.id), to: t.to })),
]

export const TRACK_SECTIONS = [
  {
    prefix: '/dsa',
    label: trackLabel('dsa'),
    items: [
      { label: 'Overview', to: '/dsa', exact: true },
      // `fallback` means "active whenever nothing else in this section matches",
      // which is how an individual chapter page keeps Chapters highlighted.
      { label: 'Chapters', to: '/dsa/chapters', fallback: true },
      { label: 'Patterns', to: '/dsa/patterns' },
      { label: 'Problems', to: '/dsa/problems' },
      { label: 'Cheat Sheet', to: '/dsa/cheatsheet' },
      { label: 'Roadmap', to: '/dsa/roadmap' },
    ],
  },
  // No pages yet, so no second bar is rendered for these. Add them here when a
  // track is written and its sub-navigation appears on its own.
  { prefix: '/spring', label: trackLabel('spring'), items: [] },
  { prefix: '/system-design', label: trackLabel('system-design'), items: [] },
]

export function sectionFor(pathname) {
  return (
    TRACK_SECTIONS.find(
      (s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`),
    ) || null
  )
}

export function matchesPath(item, pathname) {
  if (item.exact) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

/** The one item in a section that should read as current. */
export function activeItem(section, pathname) {
  if (!section) return null
  return (
    section.items.find((it) => !it.fallback && matchesPath(it, pathname)) ||
    section.items.find((it) => it.fallback) ||
    null
  )
}
