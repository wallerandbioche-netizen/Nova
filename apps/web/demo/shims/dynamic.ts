/**
 * `next/dynamic` stand-in: the demo bundles every component, so a dynamic
 * import only needs to resolve to the module's default-ish export.
 */
import { lazy, Suspense, createElement, type ComponentType } from 'react';

interface DynamicOptions {
  ssr?: boolean;
  loading?: ComponentType;
}

export default function dynamic<P extends object>(
  loader: () => Promise<ComponentType<P>>,
  options: DynamicOptions = {},
): ComponentType<P> {
  const Lazy = lazy(async () => ({ default: await loader() }));
  const Loading = options.loading;

  return function Dynamic(props: P) {
    return createElement(
      Suspense,
      { fallback: Loading ? createElement(Loading) : null },
      createElement(Lazy, props),
    );
  };
}
