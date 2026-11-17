/** Registry of step forms with unsaved edits. The update prompt reads it before reloading. */
const dirty = new Set<string>();

export function setFormDirty(formId: string, isDirty: boolean): void {
  if (isDirty) dirty.add(formId);
  else dirty.delete(formId);
}

export function anyFormDirty(): boolean {
  return dirty.size > 0;
}

export function resetDirtyForms(): void {
  dirty.clear();
}
