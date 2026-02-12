export interface OnInit {
  onInit(): Promise<void> | void;
}

export interface OnDestroy {
  onDestroy(): Promise<void> | void;
}

export function hasOnInit(value: unknown): value is OnInit {
  return value != null && typeof (value as any).onInit === 'function';
}

export function hasOnDestroy(value: unknown): value is OnDestroy {
  return value != null && typeof (value as any).onDestroy === 'function';
}

export function diagnostics(): any {
  return {
    module: '@moribashi/common',
  };
}
