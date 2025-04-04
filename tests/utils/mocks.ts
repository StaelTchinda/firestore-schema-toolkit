export class MockDocumentReference {
  id: string;
  path: string;
  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
  get = jest.fn().mockResolvedValue({
    data: () => ({ name: 'Author Name' }),
  });
}