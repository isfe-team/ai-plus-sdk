/*!
 * error | bqliu
 */

export enum Error {
  RESPONSE_ERROR = 'RESPONSE_ERROR',
  NO_RESPONSE = 'NO_RESPONSE',
  NOT_SUPPORTED_TYPE = 'NOT_SUPPORTED_TYPE',
  GET_TYPE_ERROR = 'GET_TYPE_ERROR'
}

export interface AISdkError<T = any> {
  AISdkError: true;
  type: Error;
  error?: T;
}

export function genError <T = any> (type: Error, error?: T): AISdkError<T> {
  return {
    AISdkError: true,
    type,
    error
  }
}

export function isAISdkError (error: any): error is AISdkError {
  return error.AISdkError === true
}
