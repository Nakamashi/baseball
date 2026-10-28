/** Provisional contact-to-first targets, not population averages. */
export const homeToFirst = { slow: 5.3, average: 4.7, fast: 4.2 };
export const runnerAcceleration = 5.5;
export const batterStart = 0.1;
export function calibratedMaximum(
  distance: number,
  time: number,
  acceleration: number,
  delay: number,
) {
  const t = time - delay,
    discriminant =
      acceleration * acceleration * t * t - 2 * acceleration * distance;
  if (discriminant < 0 || t <= 0)
    throw new Error(
      "Contact-to-first target cannot be reached under this acceleration profile",
    );
  return acceleration * t - Math.sqrt(discriminant);
}
