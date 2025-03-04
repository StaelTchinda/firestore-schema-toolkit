declare module 'json-schema-generator' {
  /**
   * Generates a JSON schema from a JavaScript object or array
   * @param object The object to generate a schema from
   * @returns A JSON schema object
   */
  function toJsonSchema(object: unknown): Record<string, unknown>;
  export = toJsonSchema;
}
