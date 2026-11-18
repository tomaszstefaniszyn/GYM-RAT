import { PersonGlyph } from './mark'

export function Avatar({ src, size = 52, alt = '' }: { src: string | null; size?: number; alt?: string }) {
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden={alt ? undefined : true}>
      {src ? (
        // Authenticated image from our own API.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} />
      ) : (
        <PersonGlyph />
      )}
    </span>
  )
}
