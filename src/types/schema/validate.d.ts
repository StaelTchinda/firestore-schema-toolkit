import { ErrorObject } from "ajv";

export interface ErrorArrayObject extends ErrorObject {
  instancePaths: string[];
}