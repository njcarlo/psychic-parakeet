const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  assertLatitude(lat1, 'lat1');
  assertLatitude(lat2, 'lat2');
  assertLongitude(lng1, 'lng1');
  assertLongitude(lng2, 'lng2');

  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const sinHalfLat = Math.sin(deltaLat / 2);
  const sinHalfLng = Math.sin(deltaLng / 2);
  const a =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinHalfLng * sinHalfLng;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function assertLatitude(value: number, name: string): void {
  if (!Number.isFinite(value) || value < -90 || value > 90) {
    throw new RangeError(`${name} must be a finite latitude between -90 and 90`);
  }
}

function assertLongitude(value: number, name: string): void {
  if (!Number.isFinite(value) || value < -180 || value > 180) {
    throw new RangeError(`${name} must be a finite longitude between -180 and 180`);
  }
}
