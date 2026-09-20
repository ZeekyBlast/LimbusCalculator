/** P(exactly k heads in n independent flips with heads chance p), for k = 0..n. */
export function binomialPmf(n: number, p: number): number[] {
  const pmf = new Array<number>(n + 1).fill(0)
  let choose = 1
  for (let k = 0; k <= n; k++) {
    pmf[k] = choose * Math.pow(p, k) * Math.pow(1 - p, n - k)
    choose = (choose * (n - k)) / (k + 1)
  }
  return pmf
}
