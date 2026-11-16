export const INVITE_SENTENCE =
  'Cześć, zapraszam Cię do Twojego panelu treningowego w aplikacji Gym Rat. Kliknij w poniższy link, aby otworzyć swój plan treningowy'

export function inviteText(url: string) {
  return `${INVITE_SENTENCE}\n\n${url}`
}
