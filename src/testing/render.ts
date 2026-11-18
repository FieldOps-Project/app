import type { ReactElement } from 'react';
import { act } from 'react';
import { create, type ReactTestRendererJSON, type ReactTestRenderer } from 'react-test-renderer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function render(element: ReactElement): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(element);
  });
  if (renderer === undefined) {
    throw new Error('A renderização não produziu uma árvore.');
  }
  return renderer;
}

function collect(node: ReactTestRendererJSON | string | null, found: string[]): void {
  if (node === null) {
    return;
  }
  if (typeof node === 'string') {
    found.push(node);
    return;
  }
  node.children?.forEach((child) => collect(child, found));
}

export function renderedText(renderer: ReactTestRenderer): string {
  const found: string[] = [];
  const tree = renderer.toJSON();
  (Array.isArray(tree) ? tree : [tree]).forEach((node) => collect(node, found));
  return found.join(' ');
}
