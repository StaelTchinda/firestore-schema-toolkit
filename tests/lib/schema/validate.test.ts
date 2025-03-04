import { ErrorObject } from 'ajv';
import { mergeValidationErrors, mapItemSchemaToCollectionSchema } from 'src/lib/schema/validate';

// src/lib/schema/validate.test.ts

describe('mergeValidationErrors', () => {
  it('should return empty array when no errors provided', () => {
    const errors: ErrorObject[] = [];
    const result = mergeValidationErrors(errors);
    expect(result).toEqual([]);
  });

  it('should return single error when one error provided', () => {
    const errors: ErrorObject[] = [
      {
        keyword: 'type',
        instancePath: '/name',
        schemaPath: '#/properties/name/type',
        params: { type: 'string' },
        message: 'should be string'
      } as ErrorObject
    ];

    const result = mergeValidationErrors(errors);
    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      ...errors[0],
      instancePaths: ['/name']
    });
  });

  it('should not merge errors with different properties', () => {
    const errors: ErrorObject[] = [
      {
        keyword: 'type',
        instancePath: '/name',
        schemaPath: '#/properties/name/type',
        params: { type: 'string' },
        message: 'should be string'
      } as ErrorObject,
      {
        keyword: 'required',
        instancePath: '/address',
        schemaPath: '#/properties/address/required',
        params: { missingProperty: 'city' },
        message: 'should have required property city'
      } as ErrorObject
    ];

    const result = mergeValidationErrors(errors);
    expect(result.length).toBe(2);
    expect(result[0].instancePaths).toEqual(['/name']);
    expect(result[1].instancePaths).toEqual(['/address']);
  });

  it('should merge errors with same properties', () => {
    const errors: ErrorObject[] = [
      {
        keyword: 'type',
        instancePath: '/users/0/name',
        schemaPath: '#/properties/name/type',
        params: { type: 'string' },
        message: 'should be string'
      } as ErrorObject,
      {
        keyword: 'type',
        instancePath: '/users/1/name',
        schemaPath: '#/properties/name/type',
        params: { type: 'string' },
        message: 'should be string'
      } as ErrorObject
    ];

    const result = mergeValidationErrors(errors);
    expect(result.length).toBe(1);
    expect(result[0].instancePaths).toEqual(['/users/0/name', '/users/1/name']);
    expect(result[0].instancePath).toBe('/users/0/name,/users/1/name');
  });

  it('should handle mixed unique and duplicate errors', () => {
    const errors: ErrorObject[] = [
      {
        keyword: 'type',
        instancePath: '/users/0/name',
        schemaPath: '#/properties/name/type',
        params: { type: 'string' },
        message: 'should be string'
      } as ErrorObject,
      {
        keyword: 'type',
        instancePath: '/users/1/name',
        schemaPath: '#/properties/name/type',
        params: { type: 'string' },
        message: 'should be string'
      } as ErrorObject,
      {
        keyword: 'required',
        instancePath: '/users/0',
        schemaPath: '#/required',
        params: { missingProperty: 'age' },
        message: 'should have required property age'
      } as ErrorObject
    ];

    const result = mergeValidationErrors(errors);
    expect(result.length).toBe(2);
    
    // Find the merged type error
    const typeError = result.find(e => e.keyword === 'type');
    expect(typeError?.instancePaths).toEqual(['/users/0/name', '/users/1/name']);
    expect(typeError?.instancePath).toBe('/users/0/name,/users/1/name');
    
    // Find the required error
    const requiredError = result.find(e => e.keyword === 'required');
    expect(requiredError?.instancePaths).toEqual(['/users/0']);
  });
  
  it('should correctly check equality of complex params objects', () => {
    const errors: ErrorObject[] = [
      {
        keyword: 'enum',
        instancePath: '/status',
        schemaPath: '#/properties/status/enum',
        params: { allowedValues: ['active', 'pending', 'inactive'] },
        message: 'should be equal to one of the allowed values'
      } as ErrorObject,
      {
        keyword: 'enum',
        instancePath: '/type',
        schemaPath: '#/properties/status/enum',
        params: { allowedValues: ['active', 'pending', 'inactive'] },
        message: 'should be equal to one of the allowed values'
      } as ErrorObject
    ];

    const result = mergeValidationErrors(errors);
    expect(result.length).toBe(1);
    expect(result[0].instancePaths).toEqual(['/status', '/type']);
    expect(result[0].instancePath).toBe('/status,/type');
  });
});

describe('mapItemSchemaToCollectionSchema', () => {
  it('should convert item schema to collection schema', () => {
    const itemSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    };
    
    const result = mapItemSchemaToCollectionSchema(itemSchema);
    
    expect(result).toEqual({
      type: 'array',
      items: itemSchema
    });
  });
});