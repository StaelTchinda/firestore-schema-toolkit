import { ErrorObject, Schema } from "ajv";
import { ErrorArrayObject } from "src/types/schema/validate";

export function mergeValidationErrors(
  errors: ErrorObject[]
): ErrorArrayObject[] {
  // Merge errors with the same message, params, keyword, schemaPath. The instancePath are concatenated and collected in an array.
  const mergedErrors: ErrorArrayObject[] = [];
  for (const error of errors) {
    const existingError = mergedErrors.find(
      (e) =>
        e.keyword === error.keyword &&
        e.message === error.message &&
        JSON.stringify(e.params) === JSON.stringify(error.params) &&
        e.schemaPath === error.schemaPath
    );
    if (existingError) {
      existingError.instancePaths.push(error.instancePath);
      existingError.instancePath = existingError.instancePaths.join(",");
    } else {
      mergedErrors.push({ ...error, instancePaths: [error.instancePath] });
    }
  }

  return mergedErrors;
}

export function mapItemSchemaToCollectionSchema(itemSchema: Schema): Schema {
  return {
    type: "array",
    items: itemSchema,
  };
}