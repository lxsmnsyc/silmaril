export type Success<T> = [true, T];

export type Failure = [false, any];

export type Result<T> = Success<T> | Failure;

export function pcall<T>(
  cb: () => T,
): Result<T> {
  try {
    return [true, cb()];
  } catch (error) {
    return [false, error];
  }
}
export function unwrap<T>([isSuccess, value]: Result<T>): T {
  if (isSuccess) {
    return value;
  }
  throw value;
}
