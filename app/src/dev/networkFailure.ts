export const networkFailureRef = { current: false };

export function setNetworkFailure(on: boolean): void {
  networkFailureRef.current = on;
}

export function getNetworkFailure(): boolean {
  return networkFailureRef.current;
}
