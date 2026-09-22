import { tracks, tracksById, trackLabel } from '../content/tracks.js'

/**
 * Navigation is two-level on purpose.
 *
 * TRACKS are the only links shown on every page — one entry per track, so the
 * global bar stays the same size no matter how many pages a track grows.
 *
 * TRACK_SECTIONS holds each track's own pages. They appear in a second bar that
 * is only rendered while you are inside that track. A track with no chapters
 * yet has no items, so no second bar is drawn for it.
 */
export const TRACKS = [
  { label: 'Home', to: '/', exact: true },
  ...tracks.map((t) => ({ label: trackLabel(t.id), to: t.to })),
]

/** The standard page set every finished track gets. */
function sectionItems(track) {
  if (!track.ready) return []
  return [
    { label: 'Overview', to: track.to, exact: true },
    // `fallback` means "active whenever nothing else in this section matches",
    // which is how an individual chapter page keeps Chapters highlighted.
    { label: 'Chapters', to: `${track.to}/chapters`, fallback: true },
    { label: 'Patterns', to: `${track.to}/patterns` },
    { label: track.practice.label, to: `${track.to}/${track.practice.path}` },
    { label: 'Cheat Sheet', to: `${track.to}/cheatsheet` },
    ...(track.hasRoadmap ? [{ label: 'Roadmap', to: `${track.to}/roadmap` }] : []),
  ]
}

export const TRACK_SECTIONS = tracks.map((t) => ({
  prefix: t.to,
  label: trackLabel(t.id),
  items: sectionItems(t),
}))

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

/** Route-safe base path for a track, e.g. '/dsa'. */
export const basePath = (trackId) => tracksById[trackId]?.to ?? '/'
