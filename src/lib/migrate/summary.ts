import { PreviewChange, PreviewChangeSummaryGroup } from "src/types/migrate/change";


export function summarizePreviewChanges(previewChanges: PreviewChange[]): PreviewChangeSummaryGroup[] {
  const groups: { [key: string]: PreviewChangeSummaryGroup } = {};
  const buildKey = (change: PreviewChange): string => `${change.operation}_${change.collectionPath}_${change.changes.map(c => c.path).join(',')}`;

  for (const change of previewChanges) {
    const key = buildKey(change);
    const {documentId, ...changeWithoutDocumentId} = change;
    if (!groups[key]) {
      groups[key] = {
        collectionPath: change.collectionPath,
        documentIds: [],
        change: changeWithoutDocumentId,
      };
    }

    groups[key].documentIds.push(documentId);
  }

  return Object.values(groups);
}