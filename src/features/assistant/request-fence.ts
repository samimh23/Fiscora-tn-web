export class AssistantRequestFence {
  private generation = 0;
  private controller: AbortController | null = null;

  begin(scope: string) {
    this.invalidate();
    this.controller = new AbortController();
    return {
      generation: this.generation,
      scope,
      signal: this.controller.signal,
    };
  }

  isCurrent(token: { generation: number; scope: string }, scope: string) {
    return token.generation === this.generation && token.scope === scope;
  }

  invalidate() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
  }
}
