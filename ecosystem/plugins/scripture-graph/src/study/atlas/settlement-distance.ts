/** Circular scenario geometry, not surveyed city boundaries or ancient roads. */
export type Interval = [number, number];
export interface SettlementInputs {
  centerKm: number;
  departureRadiusKm: number;
  arrivalRadiusKm: number;
  centerAllowanceKm: number;
  routeFactor: number;
  kmPerDay: number;
}
export function settlementDistances(input: SettlementInputs) {
  const {centerKm:d, departureRadiusKm:a, arrivalRadiusKm:b, centerAllowanceKm:u, routeFactor:f, kmPerDay:rate} = input;
  if (![d,a,b,u,f,rate].every(Number.isFinite) || Math.min(d,a,b,u)<0 || f<1 || rate<=0) throw new RangeError('Invalid settlement distance inputs');
  const centers: Interval = [Math.max(0,d-u),d+u];
  const sum=a+b;
  function row(id:string, label:string, straightKm:Interval|null) {
    return {id,label,straightKm,routeKm:straightKm?.map(k=>k*f) as Interval|undefined,
      days:straightKm?.map(k=>k*f/rate) as Interval|undefined};
  }
  return [
    row('centers','Center to center',centers),
    row('facing','Leave facing edge → reach facing edge',[Math.max(0,centers[0]-sum),Math.max(0,centers[1]-sum)]),
    // Triangle-inequality envelope for unspecified endpoints anywhere within the disks.
    // Gates are a subset: this envelope does not assert a gate exists at either extreme.
    row('unknown','Departure / arrival point unknown',[Math.max(0,centers[0]-sum),centers[1]+sum]),
    // Collinear diameter crossing only applies when both circular cities remain disjoint.
    row('through','Leave facing edge → cross arrival city',centers[0]>=sum ? [centers[0]-a+b,centers[1]-a+b] : null),
  ];
}
