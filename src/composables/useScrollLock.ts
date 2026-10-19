let locks = 0
let previous = ''

export function lockScroll() {
  if (locks === 0) {
    previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locks++
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1)
  if (locks === 0) document.body.style.overflow = previous
}
