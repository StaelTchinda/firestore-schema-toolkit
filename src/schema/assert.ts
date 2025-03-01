import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { SchemaAssertOptions } from 'src/types';

export class SchemaAssert {
  private firestore: Firestore;

  constructor(options: SchemaAssertOptions) {
    // Initialize Firestore with provided credentials
    this.firestore = new Firestore({
      projectId: options.projectId,
      keyFilename: options.keyFilename
    });
  }

  async assertSchema(options: SchemaAssertOptions): Promise<void> {
    const schemas: Record<string, any> = {};

    // Iterate through collections
    for (const collectionName of options.collections) {
      const snapshot = await this.firestore.collection(collectionName).get();
      
      const collectionSchema: Record<string, string> = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        Object.keys(data).forEach(key => {
          if (!collectionSchema[key]) {
            collectionSchema[key] = typeof data[key];
          }
        });
      });

      schemas[collectionName] = collectionSchema;
    }

    // Ensure output directory exists
    const outputDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write schema to JSON file
    fs.writeFileSync(
      options.outputPath, 
      JSON.stringify(schemas, null, 2)
    );

    console.log(`Schema saved to ${options.outputPath}`);
  }
}